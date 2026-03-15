
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { rateLimiter } from "firebase-functions-rate-limiter";
import * as yup from "yup";
import { recommendJobs, resumeParser, aiJobMatcher } from "./ai";

admin.initializeApp();

const limiter = rateLimiter({
  maxCalls: 100,
  periodSeconds: 3600,
});

const createUserSchema = yup.object({
  email: yup.string().email().required(),
  password: yup.string().min(8).required(),
  displayName: yup.string().required(),
  photoURL: yup.string().url(),
  userType: yup.string().oneOf(['candidate', 'employer']).required(),
});

export const createUser = functions.https.onCall(async (data, context) => {
  await limiter(context);
  
  try {
    await createUserSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
  }

  const { email, password, displayName, photoURL, userType } = data;

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

const createJobSchema = yup.object({
  title: yup.string().required(),
  description: yup.string().required(),
  company: yup.string().required(),
});

export const createJob = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to create a job.");
  }

  try {
    await createJobSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
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

const getJobsSchema = yup.object({
  query: yup.string(),
  company: yup.string(),
  location: yup.string(),
});

export const getJobs = functions.https.onCall(async (data, context) => {
  await limiter(context);
  try {
    await getJobsSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
  }

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

const applyForJobSchema = yup.object({
  jobId: yup.string().required(),
  coverLetter: yup.string().required(),
});

export const applyForJob = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to apply for a job.");
  }
  
  try {
    await applyForJobSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
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

const updateJobSchema = yup.object({
  jobId: yup.string().required(),
  title: yup.string(),
  description: yup.string(),
  company: yup.string(),
});

export const updateJob = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to update a job.");
  }
  
  try {
    await updateJobSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
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

const uploadResumeSchema = yup.object({
  fileContent: yup.string().required(),
  fileName: yup.string().required(),
});

export const uploadResume = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to upload a resume.");
  }

  try {
    await uploadResumeSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
  }

  const { fileContent, fileName } = data;
  const userId = context.auth.uid;

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

const getApplicationsSchema = yup.object({
  jobId: yup.string().required(),
});

export const getApplications = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to view applications.");
  }

  try {
    await getApplicationsSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
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

const updateApplicationStatusSchema = yup.object({
  jobId: yup.string().required(),
  applicationId: yup.string().required(),
  status: yup.string().oneOf(['submitted', 'reviewed', 'rejected', 'hired']).required(),
});

export const updateApplicationStatus = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to update an application.");
  }

  try {
    await updateApplicationStatusSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
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

const sendMessageSchema = yup.object({
  to: yup.string().required(),
  content: yup.string().required(),
});

export const sendMessage = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to send a message.");
  }

  try {
    await sendMessageSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
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

const createNotificationSchema = yup.object({
  userId: yup.string().required(),
  message: yup.string().required(),
});

export const createNotification = functions.https.onCall(async (data, context) => {
  await limiter(context);
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in to create a notification.");
  }

  try {
    await createNotificationSchema.validate(data);
  } catch (error) {
    throw new functions.https.HttpsError('invalid-argument', error.message);
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

// AI Functions
export { recommendJobs, resumeParser, aiJobMatcher };
