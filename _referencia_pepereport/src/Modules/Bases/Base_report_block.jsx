import React, { Fragment, useEffect, useState } from "react";
import jsPDF from "jspdf";

import { Button } from "@mui/material";
import { QRCodeCanvas } from 'qrcode.react';
import { format } from "date-fns";
import { useParams } from "react-router";
import { useDispatch } from "react-redux";
import { open_back } from "../../Redux/ComDuks";
import { Height } from "@mui/icons-material";


export default function Base_report_block() {

    const [qrimage, setQrimage] = useState(null)
    const [codigo, setCodigo] = useState(null)
    let version = 'alpha_block_001'
    let logo = localStorage.getItem('logo')
    let back = localStorage.getItem('background')

    let params = useParams()
    let dispatch = useDispatch()

    const [mensaje, setMensaje] = useState('Iniciando')




    let fontSize = 7
    let m = 7.5//margen general
    let l = 3.5//espaciado de lineas

    let b = 210 / 12//division de bloques en base a 12



    //bloques de trabajo

    const titulo = (doc, texto, lineapagina) => {
        doc.text(m + 100, (l * lineapagina) + 3, '' + texto, { align: "center" })
        doc.rect(m, (l * lineapagina), 201, l * 1)
    }

    const blockpar = (doc, texto, lineapagina, pos, ancho) => {//

        let f = 201 / 20
        doc.text(m + (f * (pos - 1)) + 0.5, (l * lineapagina) + 3, '' + texto, { align: "left" })
        doc.rect(m + (f * (pos - 1)), (l * lineapagina), f * ancho, l)
    }

    const blockimpar = (doc, texto, lineapagina, pos, ancho) => {//

        let f = 201 / 15
        doc.text(m + (f * (pos - 1)) + 0.5, (l * lineapagina) + 3, '' + texto, { align: "left" })
        doc.rect(m + (f * (pos - 1)), (l * lineapagina), f * ancho, l)
    }

    const blockimpar2X5 = (doc, texto1, texto2, lineapagina, pos) => {//

        let f = 201 / 15

        doc.rect(m + (f * (pos - 1)), (l * lineapagina), f * 2, l)
        doc.text(m + (f * (pos - 1)) + 0.5, (l * lineapagina) + 3, '' + texto1, { align: "left" })
        doc.rect(m + (f * (pos + 1)), (l * lineapagina), f * 3, l)
        doc.text(m + (f * (pos + 1)) + 0.5, (l * lineapagina) + 3, '' + texto2, { align: "left" })

    }


    const blockpar2X5 = (doc, texto1, texto2, lineapagina, pos) => {//

        let f = 201 / 10

        doc.rect(m + (f * (pos - 1)), (l * lineapagina), f * 2, l)
        doc.text(m + (f * (pos - 1)) + 0.5, (l * lineapagina) + 3, '' + texto1, { align: "left" })
        doc.rect(m + (f * (pos + 1)), (l * lineapagina), f * 3, l)
        doc.text(m + (f * (pos + 1)) + 0.5, (l * lineapagina) + 3, '' + texto2, { align: "left" })

    }


    const blockrecepcion = (doc, texto1, texto2, lineapagina, pos) => {//

        let f = 201 / 4

        doc.setFont('helvetica', 'bold')
        doc.rect(m + (f * (pos - 1)), (l * lineapagina), f, l)
        doc.text(m + 25 + (f * (pos - 1)) + 0.5, (l * lineapagina) + 3, '' + texto1, { align: "center" })

        doc.setFont('helvetica', 'normal')
        doc.rect(m + (f * (pos - 1)), (l * (lineapagina + 1)), f, l)
        doc.text(m + 25 + (f * (pos - 1)) + 0.5, (l * (lineapagina + 1)) + 3, '' + texto2, { align: "center" })




        doc.rect(m + (f * (pos - 1)), (l * (lineapagina + 2)), f, l * 7)
        doc.text(m + 25 + (f * (pos - 1)) + 0.5, (l * (lineapagina + 8)) + 3, 'FIRMA', { align: "center" })




    }


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




    //----------------------------------------------------------------------

    //----------------------------------------------------------------------



    const addHeaders = (doc) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont("times");
        doc.setFontSize(fontSize);

        l = 4

        for (var i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(0, 0, 0)

            //Cuadro de logo   
            doc.rect(m, l * 2, 39, l * 6)
            // doc.rect(5, 2 * l, 42, 30)//margen izq//margen sup//ancho//largo
            //Cuadro datos de empresa 
            doc.rect(m + 40, l * 2, 120, l * 6)
            doc.setFont('helvetica', 'bold')

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


            //FOTOGRAFIA DE LOGO  
            doc.addImage(logo, 'JPEG', 8, 8 + 0.5, 38, 23)

            doc.setFontSize(fontSize + 1)
            doc.text(m + 100, 12, localStorage.getItem("e1"), { align: "center" })
            doc.setFontSize(fontSize)

            doc.text(m + 100, 15, localStorage.getItem("e2"), { align: "center" })
            doc.text(m + 100, 19, localStorage.getItem("e3"), { align: "center" })
            doc.text(m + 100, 23, localStorage.getItem("e4"), { align: "center" })
            doc.text(m + 100, 27, localStorage.getItem("e5"), { align: "center" })
            doc.text(m + 100, 31, localStorage.getItem("e6"), { align: "center" })




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



        //datos de cabecera
        doc.addImage(back, 'JPEG', m, 52, 200, 200)

        //AL INICIAR UN BLOQUE SE DEBE PONER LA LINEA DE TRABAJO INDIVIDUAL
        titulo(doc, "TITULO DE MODULO", 18.8)

        blockimpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 20, 1)// = (doc, texto1, texto2, lineapagina, pos, ancho) => {//
        blockimpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 21, 6)
        blockimpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 22, 11)
        blockpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 23, 1)
        blockpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 23, 6)

        blockrecepcion(doc, 'RODRIGO ALEXIS VALENCIA', 'SUPERVISOR', 35, 1)


        blockrecepcion(doc, 'RODRIGO ALEXIS VALENCIA', 'SUPERVISOR', 40, 2)
        blockrecepcion(doc, 'RODRIGO ALEXIS VALENCIA', 'SUPERVISOR', 45, 3)


        blockrecepcion(doc, 'RODRIGO ALEXIS VALENCIA', 'SUPERVISOR', 50, 4)

        //fin datos de cabecera



        doc.addPage()
        //FOTOGRAFIA DE BACKGROUND  
        doc.addImage(back, 'JPEG', m, 52, 200, 200)

        const imgProps = doc.getImageProperties(back);
        const width = imgProps.width;
        const height = imgProps.height;


        //AL INICIAR UN BLOQUE SE DEBE PONER LA LINEA DE TRABAJO INDIVIDUAL
        titulo(doc, 'ANCHO : ' + width + ' ALTO : ' + height, 18.8)

        blockimpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 20, 1)// = (doc, texto1, texto2, lineapagina, pos, ancho) => {//
        blockimpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 21, 6)
        blockimpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 22, 11)
        blockpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 23, 1)
        blockpar2X5(doc, "NOMBRE", "RODRIGO VALENCIA", 23, 6)

        blockrecepcion(doc, 'RODRIGO ALEXIS VALENCIA', 'SUPERVISOR', 35, 1)


        blockrecepcion(doc, 'RODRIGO ALEXIS VALENCIA', 'SUPERVISOR', 40, 2)
        blockrecepcion(doc, 'RODRIGO ALEXIS VALENCIA', 'SUPERVISOR', 45, 3)


        blockrecepcion(doc, 'RODRIGO ALEXIS VALENCIA', 'SUPERVISOR', 50, 4)

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


