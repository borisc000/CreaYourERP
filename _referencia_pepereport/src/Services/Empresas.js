import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./Firebase";
import { format } from "date-fns";





//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function guardartiposdeservicios(data) {


    const myRef = doc(collection(db, "00_tiposervicios"));
    //const myRef = doc(db, "00_reports", "testid");
    data.active = true

    data.valor = data.servicio.toUpperCase()




    await setDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);
    return data.hdate

}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function guardarMandante(data) {


    const myRef = doc(collection(db, "00_mandantes"));
    //const myRef = doc(db, "00_reports", "testid");
    data.active = true
    data.nombre = data.nombre.toUpperCase()
    data.email = data.email.toUpperCase()
    await setDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);
    return data.hdate

}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function guardarArea(data) {


    const myRef = doc(collection(db, "00_areas"));
    //const myRef = doc(db, "00_reports", "testid");
    data.active = true
    data.area = data.area.toUpperCase()
    data.descripcion = data.descripcion.toUpperCase()
    await setDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);
    return data.hdate

}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function guardarSector(data) {

    const myRef = doc(collection(db, "00_sectores"));
    //const myRef = doc(db, "00_reports", "testid");
    data.emision = Date.now()
    data.active = true
    data.sector = data.sector.toUpperCase()
    data.descripcion = data.descripcion.toUpperCase()
    await setDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);
    return data.hdate

}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function guardarEmpresa(data) {

    const myRef = doc(collection(db, "00_empresas"));
    //const myRef = doc(db, "00_reports", "testid");
    data.emision = Date.now()
    data.id = myRef.id
    data.empresa = data.empresa.toUpperCase()
    data.active = true
    data.cdate = Date.now()
    data.descripcion = data.descripcion.toUpperCase()
    await setDoc(myRef, data);
    //await setDoc(doc(db, "cities", "new-city-id"), data);
    return data.hdate

}
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function ActualizarEmpresa(data) {

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
export async function CargarEmpresas(s) {


    let data = []

    const q = query(collection(db, "00_empresas"), where("active", "==", true));

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
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export async function CargarEmpresa(data) {



    const docRef = doc(db, "00_checkpoints", data);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {

        return docSnap.data()

    } else {
        console.log("No hay documentos registrados");
    }
}

//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
