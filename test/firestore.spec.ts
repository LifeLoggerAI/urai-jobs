import * as firebase from '@firebase/testing';
import * as fs from 'fs';

const projectId = 'urai-jobs';
const rules = fs.readFileSync('firestore.rules', 'utf8');

function authedApp(auth) {
  return firebase.initializeTestApp({ projectId, auth }).firestore();
}

function adminApp() {
  return firebase.initializeAdminApp({ projectId }).firestore();
}


describe('Firestore rules', () => {
  before(async () => {
    await firebase.loadFirestoreRules({ projectId, rules });
  });

  after(async () => {
    await Promise.all(firebase.apps().map(app => app.delete()));
  });

  it('should allow public to read jobPublic', async () => {
    const db = authedApp(null);
    const jobPublic = db.collection('jobPublic').doc('test');
    await firebase.assertSucceeds(jobPublic.get());
  });

  it('should not allow public to read applicants', async () => {
    const db = authedApp(null);
    const applicant = db.collection('applicants').doc('test');
    await firebase.assertFails(applicant.get());
  });

  it('should not allow public to read applications', async () => {
    const db = authedApp(null);
    const application = db.collection('applications').doc('test');
    await firebase.assertFails(application.get());
  });

  it('should allow admin to read applicants', async () => {
    const db = adminApp();
    const applicant = db.collection('applicants').doc('test');
    await firebase.assertSucceeds(applicant.get());
  });

  it('should allow admin to read applications', async () => {
    const db = adminApp();
    const application = db.collection('applications').doc('test');
    await firebase.assertSucceeds(application.get());
  });

  it('should allow public to create an application with valid schema', async () => {
    const db = authedApp(null);
    const application = db.collection('applications').doc('test');
    await firebase.assertSucceeds(application.set({
      jobId: 'test',
      applicantId: 'test',
      applicantEmail: 'test@test.com',
      answers: {},
      resume: {},
      tags: [],
      notesCount: 0,
    }));
  });

  it('should not allow public to create an application with invalid schema', async () => {
    const db = authedApp(null);
    const application = db.collection('applications').doc('test');
    await firebase.assertFails(application.set({
      jobId: 'test',
      applicantId: 'test',
      applicantEmail: 'test@test.com',
      answers: {},
      resume: {},
      tags: [],
      notesCount: 0,
      extraField: 'test'
    }));
  });

  it('should allow admin to set application status', async () => {
    const admin = adminApp();
    await admin.collection('admins').doc('admin').set({ role: 'admin' });
    const db = authedApp({ uid: 'admin', admin: true });

    const functions = firebase.initializeTestApp({ projectId, auth: { uid: 'admin' } }).functions();
    const setStatus = functions.httpsCallable('adminSetApplicationStatus');

    const application = await admin.collection('applications').add({
        jobId: 'test',
        applicantId: 'test',
        applicantEmail: 'test@test.com',
        status: 'NEW',
    });

    const result = await setStatus({ applicationId: application.id, status: 'SCREEN' });
    expect(result.data.success).to.be.true;

    const updatedApplication = await admin.collection('applications').doc(application.id).get();
    expect(updatedApplication.data().status).to.equal('SCREEN');
  });
});
