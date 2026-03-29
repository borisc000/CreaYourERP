import { collection, doc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./Firebase";

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function BuscarRun(run) {

    let data = {}

    const q = query(collection(db, "00_personal"), where("run", "==", run));

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        // doc.data() is never undefined for query doc snapshots
        //  console.log(doc.id, " => ", doc.data());
        data = doc.data()
    });

    return data

}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function ActualizarPersonal(data) {



    // const myRef = doc(collection(db, "cities"));

    //data.id = myRef.id


    //  const myRef = doc(collection(db, "00_personal"));
    const myRef = doc(db, "00_personal", data.id);
    data.active = true

    data.udate = Date.now()
    data.pnombre = data.pnombre.toUpperCase()
    data.snombre = data.snombre.toUpperCase()
    data.apppat = data.apppat.toUpperCase()
    data.appmat = data.appmat.toUpperCase()
    data.sn = data.pnombre.toUpperCase() + ' ' + data.apppat.toUpperCase()
    data.snr = data.run + ' - ' + data.pnombre.toUpperCase() + ' ' + data.apppat.toUpperCase()
    data.snc = data.cargo + ' - ' + data.pnombre.toUpperCase() + ' ' + data.apppat.toUpperCase()


    await updateDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);


}

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function GuardarPersonal(data) {



    // const myRef = doc(collection(db, "cities"));

    //data.id = myRef.id


    const myRef = doc(collection(db, "00_personal"));
    //const myRef = doc(db, "00_persons", "testid");
    data.active = true
    data.id = myRef.id
    data.cdate = Date.now()
    data.pnombre = data.pnombre.toUpperCase()
    data.snombre = data.snombre.toUpperCase()
    data.apppat = data.apppat.toUpperCase()
    data.appmat = data.appmat.toUpperCase()
    data.sn = data.pnombre.toUpperCase() + ' ' + data.apppat.toUpperCase()
    data.snr = data.run + ' - ' + data.pnombre.toUpperCase() + ' ' + data.apppat.toUpperCase()
    data.snc = data.cargo + ' - ' + data.pnombre.toUpperCase() + ' ' + data.apppat.toUpperCase()


    await setDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);







}

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function CargarPersonal() {


    let data = []

    const q = query(collection(db, "00_personal"), where("active", "==", true));

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        // doc.data() is never undefined for query doc snapshots
        //  console.log(doc.id, " => ", doc.data());

        let ob = {}
        ob = doc.data()
        ob.cnombre = doc.data().pnombre + " " + doc.data().snombre + " " + doc.data().apppat + " " + doc.data().appmat



        data.push(ob)
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
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx