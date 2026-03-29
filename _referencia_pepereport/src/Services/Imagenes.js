import { getDownloadURL, getStorage, ref, uploadBytes, uploadString } from "firebase/storage";

import Resizer from "react-image-file-resizer";




const resizeFile = (file) =>
    new Promise((resolve) => {
        Resizer.imageFileResizer(
            file,
            500,
            500,
            "JPEG",
            100,
            0,
            (uri) => {
                resolve(uri);
            },
            "base64"
        );
    });



export const redimencion = async (file) => {


    return new Promise((resolve) => {
            Resizer.imageFileResizer(
                file,
                300,
                300,
                "JPEG",
                100,
                0,
                (uri) => {
                    console.log(file)
                    resolve(uri);
                },
                "base64"
            );
        });





}


export const imagenb64 = async (d) => {

    const file = d.target.files[0]
    const image = await resizeFile(file)

    return image


}



export const imagenb64v2 = async (d) => {


    const file = d.target.files[0]
    const image = await resizeFile(file)





    const storage = getStorage();
    const storageRef = ref(storage, 'f' + Date.now());

    return uploadString(storageRef, image, 'data_url').then((snapshot) => {

        console.log('Uploaded a data_url string!');


        return getDownloadURL(snapshot.ref).then((downloadURL) => {
            console.log('File available at', downloadURL);
            return downloadURL
        });



    })






}

