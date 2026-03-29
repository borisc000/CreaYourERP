import React, { Fragment, useEffect, useState } from "react";
import jsPDF from "jspdf";

import { Button } from "@mui/material";
import { QRCodeCanvas } from 'qrcode.react';
import { format } from "date-fns";
import { useParams } from "react-router";
import { useDispatch } from "react-redux";
import { open_back } from "../../Redux/ComDuks";


export default function Base_report() {

    const [qrimage, setQrimage] = useState(null)
    const [codigo, setCodigo] = useState(null)
    let version = 'B_001'
    let logo = localStorage.getItem('logo')
    let back = localStorage.getItem('background')

    let params = useParams()
    let dispatch = useDispatch()

    const [mensaje, setMensaje] = useState('Iniciando')




    let fontSize = 8.5
    let m = 7.5//margen general
    let l = 4//espaciado de lineas

    //Efectos de usuario



    useEffect(() => {

        if (qrimage) {
            dispatch(open_back(false, 'Generando reporte'))
            jsPdfGenerator()
        }

    }, [qrimage])

    //Funciones usuario
    //----------------------------------------------------------------------
    const convertir = (c) => {

        dispatch(open_back(true, 'Lanzando'))

        setQrimage(null)
        var canvas = document.getElementById('canvas');
        setTimeout(() => {
            var dataURL = canvas.toDataURL();
            setQrimage(dataURL)
        }, 1000);
    }
    //----------------------------------------------------------------------
    const fecha = (mifecha) => {
        let f = format(mifecha, 'yyyy-MM-dd HH:mm:ss')
        return f
    }
    //----------------------------------------------------------------------
    const imprimir = () => {
        jsPdfGenerator()
    }
    //----------------------------------------------------------------------
    const bloque_titulo = (doc, linea) => {

        doc.text(m + 100, 12, '' + codigo, { align: "center" })


    }



    //----------------------------------------------------------------------

    //----------------------------------------------------------------------



    const addHeaders = (doc) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont("times");
        doc.setFontSize(fontSize);


        for (var i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(0, 0, 0)

            //Cuadro de logo   
            doc.rect(m, l * 2, 39, l * 6)
            // doc.rect(5, 2 * l, 42, 30)//margen izq//margen sup//ancho//largo
            //Cuadro datos de empresa 
            doc.rect(m + 40, l * 2, 120, l * 6)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(fontSize + 1);

            doc.setFontSize(fontSize - 1);
            doc.setFont('helvetica', 'normal')

            //Codigo unico
            doc.rect(m + 161, l * 2, 40, l * 6)


            doc.text(m + 181, l * 2 + 3, ' codigo', { align: "center" })
            doc.rect(m + 161, l * 2, 40, l * 1)
            doc.text(m + 181, l * 8 - 1, '' + '' + fecha(Date.now()), { align: "center" })
            doc.rect(m + 161, l * 7, 40, l * 1)
            //Codigo qr   
            doc.addImage(qrimage, 'JPEG', 181, l * 3 + 0.5, 15, 15)
            //Lineas de cabecera
            let lt = 9//Linea de trabajo
            //cabeceras de documento






            //linea principal de documento
            doc.rect(m + 0, 35, 200, (l * 4) + 1)//margen,linea,ancho,alto

        }
    };




    const addFooters = (doc) => {
        const pageCount = doc.internal.getNumberOfPages();

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(fontSize);
        for (var i = 1; i <= pageCount; i++) {

            doc.setPage(i);

            let lt = 64//Linea de trabajo
            doc.rect(m + 0, lt * l, 200, l * 5)//margen,linea,ancho,alto
            // doc.text(7.5, lt * l, 200, localStorage.getItem("e6"), { align: "center" })



            doc.text(
                "Pagina " +
                String(i) +
                " de " +
                String(pageCount) + ' - Fecha de impresion : ' + fecha(Date.now()),
                doc.internal.pageSize.width / 2,
                265,
                {
                    align: "center",
                }
            );
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(fontSize - 2);
            doc.text(
                "version Documento: " + version,
                doc.internal.pageSize.width / 2,
                269,
                {
                    align: "center",
                }
            );








        }
    };






    let jsPdfGenerator = () => {
        var doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: [215, 279]
        });

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(fontSize);

        let n = 1
        let i = 0

        let pos = 97

        //datos de cabecera

        doc.setFontSize(fontSize + 1)
        doc.text(m + 100, 12, localStorage.getItem("e1"), { align: "center" })
        doc.setFontSize(fontSize)

        doc.text(m + 100, 15, localStorage.getItem("e2"), { align: "center" })
        doc.text(m + 100, 19, localStorage.getItem("e3"), { align: "center" })
        doc.text(m + 100, 23, localStorage.getItem("e4"), { align: "center" })
        doc.text(m + 100, 27, localStorage.getItem("e5"), { align: "center" })
        doc.text(m + 100, 31, localStorage.getItem("e6"), { align: "center" })



        //FOTOGRAFIA DE LOGO  
        doc.addImage(logo, 'JPEG', 8, l * 2 + 0.5, 38, 23)

        //FOTOGRAFIA DE BACKGROUND  
        doc.addImage(back, 'JPEG', m, l * 14, 200, 200)

        //fin datos de cabecera

        // Save the Data
        addHeaders(doc);
        addFooters(doc);
        doc.output('save', 'salida.pdf');

    };

    //


    //pdf





    return (
        <Fragment>



            <Button variant='contained' size='small' color="warning" fullWidth onClick={() => {

                let t = params.id
                console.log(t)
                setCodigo(t)

                convertir(t)

            }}>Imprimir reporte</Button>



            <QRCodeCanvas style={{ display: 'none' }} id='canvas' value={'' + codigo} />



        </Fragment >
    );
}


