import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./Firebase";
import { format } from "date-fns";




//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function guardarCheckPoint(data) {

    const myRef = doc(collection(db, "00_checkpoints"));
    //const myRef = doc(db, "00_reports", "testid");
    data.emision = parseInt(format(new Date(data.emision), "T"))
    data.id = myRef.id
    data.active = true
    data.cdate = Date.now()
    data.hdate = format(Date.now(), 'yyyy-MM-dd HH:mm:ss')
    data.descripcion = data.descripcion.toUpperCase()
    await setDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);
    return data.hdate

}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function ActualizarCheckPoint(data) {

    //const myRef = doc(collection(db, "00_checkpoints"));
    const myRef = doc(db, "00_checkpoints", data.id);
    data.active = true
    data.emision = parseInt(format(new Date(data.emision), "T"))

    data.hdate = format(Date.now(), 'yyyy-MM-dd HH:mm:ss')
    data.descripcion = data.descripcion.toUpperCase()
    await setDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);
    return data.idas

}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx


//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function cargarcheckpoints(idas) {

    if (idas) {

        let data = []

        const q = query(collection(db, "00_checkpoints"), where("active", "==", true), where("idas", "==", idas));

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            // doc.data() is never undefined for query doc snapshots
            //  console.log(doc.id, " => ", doc.data());
            data.push(doc.data())
        });

        data.sort(function (a, b) {
            if (a.cdate > b.cdate) {
                return 1;
            }
            if (a.cdate < b.cdate) {
                return -1;
            }
            // a must be equal to b
            return 0;
        });

        return data
    }
}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function CargarCheckpoint(data) {



    const docRef = doc(db, "00_checkpoints", data);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {

        return docSnap.data()

    } else {
        console.log("No hay documentos registrados");
    }
}

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
