

// The Firebase Admin SDK to access Firestore.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");




initializeApp();

const {
    onDocumentCreated,
    Change,
    FirestoreEvent,
    onDocumentUpdated
} = require('firebase-functions/v2/firestore');

exports.createuser = onDocumentCreated("testing/{userId}", (event) => {



    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const data = snapshot.data();

    console.log(event)
    console.log(JSON.stringify(data))

});