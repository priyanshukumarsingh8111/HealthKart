import { db } from "./firebase-config.js";

import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


async function testFirestore() {

    try {

        const docRef = await addDoc(
            collection(db, "test"),
            {
                message: "HealthKart Firestore is working!",
                createdAt: serverTimestamp()
            }
        );

        console.log("Document created:", docRef.id);

        alert("SUCCESS! Firestore is connected.");

    } catch (error) {

        console.error("Firestore Error:", error);

        alert(
            "Firestore connection failed.\n\n" +
            error.message
        );
    }
}


testFirestore();