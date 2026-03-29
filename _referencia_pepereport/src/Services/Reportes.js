import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./Firebase";
import { format } from "date-fns";



//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function CerrarReporte(data) {




    let ob = {}



    const myRef = doc(db, "00_reportes", data);
    //data.id = myRef.id
    // const myRef = doc(collection(db, "00_reportes"));




    ob.estado = "CERRADO"
    ob.fdate = Date.now()
    await updateDoc(myRef, ob);
    //await setDoc(doc(db, "cities", "new-city-id"), data);



    return data.id



}

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function ActualizarReporte(data) {

    let tr = format(new Date(data.emision), "T")






    let ob = {}



    const myRef = doc(db, "00_reportes", data.id);
    //data.id = myRef.id
    // const myRef = doc(collection(db, "00_reportes"));



    ob.emision = parseInt(tr)
    ob.empresa = data.empresa
    ob.udate = Date.now()
    ob.servicio = data.servicio.toUpperCase()
    ob.apr = data.apr.toUpperCase()
    ob.supervisor = data.supervisor.toUpperCase()
    ob.adm = data.adm.toUpperCase()
    ob.mandante = data.mandante.toUpperCase()
    ob.area = data.area
    ob.sector = data.sector
    ob.tiposervicio = data.tiposervicio
    await updateDoc(myRef, ob);
    //await setDoc(doc(db, "cities", "new-city-id"), data);



    return data.id



}

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function GuardarReporte(data) {


    // const myRef = doc(collection(db, "cities"));
    //data.id = myRef.id
    const myRef = doc(collection(db, "00_reportes"));
    //const myRef = doc(db, "00_reports", "testid");

    let t = Date.now()

    data.id = myRef.id

    data.active = true
    data.cdate = t//fecha de creacion
    data.udate = t//fecha de actualizacion 
    data.fdate = t//fecha de finalizacion o cierre
    data.estado = 'ABIERTO'
    data.servicio = data.servicio.toUpperCase()

    await setDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);



    return data.id



}

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function CargarReportes() {

    let data = []

    const q = query(collection(db, "00_reportes"), where("active", "==", true));

    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        // doc.data() is never undefined for query doc snapshots
        //  console.log(doc.id, " => ", doc.data());
        data.push(doc.data())
    });

    return data

}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function CargarReporte(data) {



    const docRef = doc(db, "00_reportes", data);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {



        return docSnap.data()

    } else {
        // docSnap.data() will be undefined in this case
        console.log("No hay documentos registrados");
    }
}

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
