// Emulator harness for Firebase Functions tests
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
process.env.GCLOUD_PROJECT = "your-erp-staging";
