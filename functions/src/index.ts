import * as functions from 'firebase-functions'
// Run daily at 3:00 UTC
export const nightlyDigest = functions.pubsub.schedule('0 3 * * *').timeZone('UTC').onRun(async () => {
// TODO: summarize Firestore → write to BigQuery or send email
console.log('nightlyDigest ran')
})
// Weekly BigQuery compaction (Sunday 02:00 UTC)
export const weeklyBQ = functions.pubsub.schedule('0 2 * * 0').timeZone('UTC').onRun(async () => {
console.log('weeklyBQ ran')
})
