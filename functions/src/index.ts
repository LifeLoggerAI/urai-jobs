import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { rateLimiter } from "firebase-functions-rate-limiter";

admin.initializeApp();

const limiter = rateLimiter({
  maxCalls: 100,
  periodSeconds: 3600,
});

export const createUser = functions.https.onCall(async (data, context) => {
  await limiter(context);
  const { email, password, displayName, photoURL, userType } = data;

  if (!userType || (userType !== 'candidate' && userType !== 'employer')) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "userType" of "candidate" or "employer".');
  }

  try {
    const usersRef = admin.firestore().collection("users");
    const existingUser = await usersRef.where("email", "==", email).get();

    if (!existingUser.empty) {
      throw new functions.https.HttpsError("already-exists", "A user with this email address already exists.");
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      photoURL,
    });

    const userDoc = {
      email,
      displayName,
      photoURL,
      userType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await admin.firestore().collection("users").doc(userRecord.uid).set(userDoc);

    if (userType === 'candidate') {
      await admin.firestore().collection('candidateProfiles').doc(userRecord.uid).set({
        userId: userRecord.uid,
        resume: '',
        skills: [],
      });
    } else if (userType === 'employer') {
      await admin.firestore().collection('employerProfiles').doc(userRecord.uid).set({
        userId: userRecord.uid,
        companyName: '',
        companyDescription: '',
      });
    }

    return { uid: userRecord.uid };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error creating user:", error);
  }
});

export const createJob = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to create a job.");
  }

  const { title, description, company } = data;

  try {
    const jobRef = await admin.firestore().collection("jobs").add({
      title,
      description,
      company,
      employerId: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { jobId: jobRef.id };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error creating job:", error);
  }
});

export const getJobs = functions.https.onCall(async (data, context) => {
  await limiter(context);
  const { query, company, location } = data;
  let jobsQuery = admin.firestore().collection("jobs").orderBy("createdAt", "desc");

  if (query) {
    jobsQuery = jobsQuery.where("title", ">=", query).where("title", "<=", query + "\uf8ff");
  }
  if (company) {
    jobsQuery = jobsQuery.where("company", "==", company);
  }
  if (location) {
    jobsQuery = jobsQuery.where("location", "==", location);
  }

  try {
    const snapshot = await jobsQuery.get();
    const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { jobs };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error getting jobs:", error);
  }
});

export const applyForJob = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to apply for a job.");
  }

  const { jobId, coverLetter } = data;
  const applicantId = context.auth.uid;

  try {
    const jobRef = admin.firestore().collection("jobs").doc(jobId);
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Job not found.");
    }

    const applicationRef = jobRef.collection("applications").doc(applicantId);

    const applicationDoc = await applicationRef.get();
    if (applicationDoc.exists) {
      throw new functions.https.HttpsError("already-exists", "You have already applied for this job.");
    }

    await applicationRef.set({
      applicantId,
      coverLetter,
      status: 'submitted',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const employerId = jobDoc.data()?.employerId;
    if (employerId) {
      await admin.firestore().collection("notifications").add({
        userId: employerId,
        message: `You have a new application for your job: ${jobDoc.data()?.title}`,
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { applicationId: applicationRef.id };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error applying for job:", error);
  }
});

export const updateJob = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to update a job.");
  }

  const { jobId, ...jobData } = data;
  const employerId = context.auth.uid;

  try {
    const jobRef = admin.firestore().collection("jobs").doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Job not found.");
    }

    if (jobDoc.data()?.employerId !== employerId) {
      throw new functions.https.HttpsError("permission-denied", "You are not authorized to update this job.");
    }

    await jobRef.update(jobData);

    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error updating job:", error);
  }
});

export const uploadResume = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to upload a resume.");
  }

  const { fileContent, fileName } = data;
  const userId = context.auth.uid;

  if (!fileContent || !fileName) {
    throw new functions.https.HttpsError("invalid-argument", "The function must be called with a fileContent and fileName.");
  }

  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  if (userDoc.data()?.userType !== 'candidate') {
    throw new functions.https.HttpsError("permission-denied", "Only candidates can upload resumes.");
  }

  const bucket = admin.storage().bucket();
  const filePath = `resumes/${userId}/${fileName}`;
  const file = bucket.file(filePath);

  try {
    const buffer = Buffer.from(fileContent, "base64");
    await file.save(buffer, { resumable: false });
    const [url] = await file.getSignedUrl({ action: 'read', expires: '03-09-2491' });

    await admin.firestore().collection('candidateProfiles').doc(userId).update({ resume: url });

    return { resumeUrl: url };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error uploading resume:", error);
  }
});

export const getApplications = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to view applications.");
  }

  const { jobId } = data;
  const employerId = context.auth.uid;

  const jobRef = admin.firestore().collection("jobs").doc(jobId);
  const jobDoc = await jobRef.get();

  if (!jobDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Job not found.");
  }

  if (jobDoc.data()?.employerId !== employerId) {
    throw new functions.https.HttpsError("permission-denied", "You are not authorized to view these applications.");
  }

  const applicationsQuery = jobRef.collection("applications").orderBy("createdAt", "desc");

  try {
    const snapshot = await applicationsQuery.get();
    const applications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { applications };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error getting applications:", error);
  }
});

export const updateApplicationStatus = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to update an application.");
  }

  const { jobId, applicationId, status } = data;
  const employerId = context.auth.uid;

  try {
    const jobRef = admin.firestore().collection("jobs").doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Job not found.");
    }

    if (jobDoc.data()?.employerId !== employerId) {
      throw new functions.https.HttpsError("permission-denied", "You are not authorized to update this application.");
    }

    const applicationRef = jobRef.collection("applications").doc(applicationId);

    await applicationRef.update({ status });

    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error updating application status:", error);
  }
});

export const jobRecommendationEngine = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  console.log('Running job recommendation engine...');
  // In a real implementation, this would query candidates and jobs, and generate recommendations.
  return null;
});

export const resumeParser = functions.storage.object().onFinalize(async (object) => {
  const { name, bucket } = object;
  console.log(`File ${name} uploaded to ${bucket}.`);
  // In a real implementation, this would parse the resume and extract skills.
  return null;
});

export const aiJobMatcher = functions.https.onCall(async (data, context) => {
  await limiter(context);
  const { jobId } = data;
  console.log(`Matching candidates for job ${jobId}...`);
  // In a real implementation, this would find the best candidates for the job.
  return { success: true };
});

export const sendMessage = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to send a message.");
  }

  const { to, content } = data;
  const from = context.auth.uid;

  try {
    const messageRef = await admin.firestore().collection("messages").add({
      from,
      to,
      content,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { messageId: messageRef.id };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error sending message:", error);
  }
});

export const createNotification = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to create a notification.");
  }

  const { userId, message } = data;

  try {
    const notificationRef = await admin.firestore().collection("notifications").add({
      userId,
      message,
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { notificationId: notificationRef.id };
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error creating notification:", error);
  }
});
