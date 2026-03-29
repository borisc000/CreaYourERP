import React, { Fragment, useEffect, useState } from "react";
import jsPDF from "jspdf";

import { Button } from "@mui/material";
import { QRCodeCanvas } from 'qrcode.react';
import { format } from "date-fns";
import { useLocation, useParams } from "react-router";
import { useDispatch } from "react-redux";
import { open_back } from "../../Redux/ComDuks";

import { applyPlugin } from 'jspdf-autotable';

applyPlugin(jsPDF); // This line is crucial to extend jsPDF with autoTable



export default function ReportePrint() {


    let params = useParams()
    let dispatch = useDispatch()
    let location = useLocation()

    const [qrimage, setQrimage] = useState(null)
    const [codigo, setCodigo] = useState(location.state.id)
    let version = 'B_001'
    let logo = localStorage.getItem('logo')
    let back = localStorage.getItem('back')


    const [checkpoints, setCheckpoints] = useState([])
    const [reporte, setReporte] = useState([])






    //autotable



    //fin autotable






    let fontSize = 7
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

        setCodigo(location.state.id)

        setCheckpoints(JSON.parse(localStorage.getItem('checkpoints')))
        setReporte(JSON.parse(localStorage.getItem('reporte')))


        dispatch(open_back(true, 'Creando reporte'))

        setQrimage(null)
        var canvas = document.getElementById('canvas');
        setTimeout(() => {
            var dataURL = canvas.toDataURL();
            setQrimage(dataURL)
        }, 1000);
    }
    //----------------------------------------------------------------------
    const fecha = (mifecha) => {
        let f = format(mifecha, 'dd-MM-yyyy HH:mm:ss')
        return f
    }
    //----------------------------------------------------------------------
    //----------------------------------------------------------------------
    const fecha2 = (mifecha) => {
        let f = format(mifecha, 'dd-MM-yyyy')
        return f
    }
    //----------------------------------------------------------------------
    const imprimir = () => {
        jsPdfGenerator()
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
            // doc.rect(m, l * 2, 39, l * 6)
            // doc.rect(5, 2 * l, 42, 30)//margen izq//margen sup//ancho//largo
            //Cuadro datos de empresa 
            //   doc.rect(m + 40, l * 2, 120, l * 6)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', 'normal')

            //Codigo unico
            doc.rect(m + 161, l * 2, 40, l * 6)


            doc.text(m + 181, l * 2 + 3, '' + codigo, { align: "center" })
            doc.rect(m + 161, l * 2, 40, l * 1)
            doc.text(m + 181, l * 8 - 1, '' + fecha(reporte.emision), { align: "center" })
            doc.rect(m + 161, l * 7, 40, l * 1)
            //Codigo qr   
            doc.addImage(qrimage, 'JPEG', 181, l * 3 + 0.5, 15, 15)
            //Lineas de cabecera
            let lt = 9//Linea de trabajo
            //cabeceras de documento
            doc.addImage(logo, 'JPEG', 8, l * 2 + 0.5, 38, 23)

            //FOTOGRAFIA DE BACKGROUND  

            doc.setFontSize(fontSize + 3)
            doc.text(m + 100, 12, localStorage.getItem("e1"), { align: "center" })
            doc.setFontSize(fontSize + 1)

            doc.text(m + 100, 15, localStorage.getItem("e2"), { align: "center" })
            doc.text(m + 100, 19, localStorage.getItem("e3"), { align: "center" })
            doc.text(m + 100, 23, localStorage.getItem("e4"), { align: "center" })
            doc.text(m + 100, 27, localStorage.getItem("e5"), { align: "center" })
            doc.text(m + 100, 31, localStorage.getItem("e6"), { align: "center" })





            //linea principal de documento
            //   doc.rect(m + 0, 35, 201, (l * 5) + 1)//margen,linea,ancho,alto

            //inicio informacion de reporte

            let lt1 = 9
            doc.setFont('helvetica', 'bold')
            doc.rect(m, l * lt1, 201, 4)//margen,linea,ancho,alto
            doc.text(m + 100, (l * lt1) + 3, 'DETALLES DE REPORTE', { align: "center" })
            //---------------------------------
            lt1 = lt1 + 1.2
            doc.setFont('helvetica', 'bold')
            doc.rect(m, l * lt1, 35, 4)//margen,linea,ancho,alto
            doc.text(m + 1, (l * lt1) + 3, 'EMISION', { align: "left" })
            doc.setFont('helvetica', 'normal')
            doc.rect(m + 35, l * lt1, 65, 4)//margen,linea,ancho,alto
            doc.text(m + 36, (l * lt1) + 3, '' + fecha(reporte.emision), { align: "left" })
            doc.setFont('helvetica', 'bold')
            doc.rect(m + 100, l * lt1, 35, 4)//margen,linea,ancho,alto
            doc.text(m + 1 + 100, (l * lt1) + 3, 'EMPRESA', { align: "left" })
            doc.setFont('helvetica', 'normal')
            doc.rect(m + 135, l * lt1, 65, 4)//margen,linea,ancho,alto
            doc.text(m + 136, (l * lt1) + 3, '' + reporte.empresa, { align: "left" })
            //---------------------------------
            lt1 = lt1 + 1
            doc.setFont('helvetica', 'bold')
            doc.rect(m, l * lt1, 35, 4)//margen,linea,ancho,alto
            doc.text(m + 1, (l * lt1) + 3, 'AREA', { align: "left" })
            doc.setFont('helvetica', 'normal')
            doc.rect(m + 35, l * lt1, 65, 4)//margen,linea,ancho,alto
            doc.text(m + 36, (l * lt1) + 3, '' + reporte.area, { align: "left" })
            doc.setFont('helvetica', 'bold')
            doc.rect(m + 100, l * lt1, 35, 4)//margen,linea,ancho,alto
            doc.text(m + 1 + 100, (l * lt1) + 3, 'SECTOR', { align: "left" })
            doc.setFont('helvetica', 'normal')
            doc.rect(m + 135, l * lt1, 65, 4)//margen,linea,ancho,alto
            doc.text(m + 136, (l * lt1) + 3, '' + reporte.sector, { align: "left" })

            //---------------------------------
            lt1 = lt1 + 1
            doc.setFont('helvetica', 'bold')
            doc.rect(m, l * lt1, 35, 4)//margen,linea,ancho,alto
            doc.text(m + 1, (l * lt1) + 3, 'TIPO DE SERVICIO', { align: "left" })
            doc.setFont('helvetica', 'normal')
            doc.rect(m + 35, l * lt1, 65, 4)//margen,linea,ancho,alto
            doc.text(m + 36, (l * lt1) + 3, '' + reporte.tiposervicio, { align: "left" })
            doc.setFont('helvetica', 'bold')
            doc.rect(m + 100, l * lt1, 35, 4)//margen,linea,ancho,alto
            doc.text(m + 1 + 100, (l * lt1) + 3, 'ESTADO', { align: "left" })
            doc.setFont('helvetica', 'normal')

            let fc = ''//fecha de cierre
            if (reporte.estado == "CERRADO") {
                fc = ' : ' + fecha(reporte.fdate)
            }



            doc.rect(m + 135, l * lt1, 65, 4)//margen,linea,ancho,alto
            doc.text(m + 136, (l * lt1) + 3, '' + reporte.estado + ' ' + fc, { align: "left" })
            //---------------------------------
            lt1 = lt1 + 1.2
            doc.setFont('helvetica', 'bold')
            doc.rect(m, l * lt1, 201, 4)//margen,linea,ancho,alto
            doc.text(m + 100, (l * lt1) + 3, 'DESCRIPCION DE SERVICIO', { align: "center" })
            doc.setFont('helvetica', 'normal')
            lt1 = lt1 + 1
            doc.rect(m, l * lt1, 201, l * 3)//margen,linea,ancho,alto
            doc.text(m + 100, (l * lt1) + 3, '' + reporte.servicio, { align: "center", maxWidth: 195 })



        }
    };




    const addFooters = (doc) => {
        const pageCount = doc.internal.getNumberOfPages();

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(fontSize);
        for (var i = 1; i <= pageCount; i++) {

            doc.setPage(i);

            let lt = 68//Linea de trabajo
            //  doc.rect(m + 0, 70 * l, 200, l * 3)//margen,linea,ancho,alto
            // doc.text(7.5, lt * l, 200, localStorage.getItem("e6"), { align: "center" })

            doc.setFontSize(fontSize + 1);
            doc.setFont('helvetica', 'bold')
            doc.text(
                "Pagina " +
                String(i) +
                " de " +
                String(pageCount) + ' - Fecha de impresion : ' + fecha(Date.now()),
                doc.internal.pageSize.width / 2,
                285,
                {
                    align: "center",
                }
            );

            doc.setFontSize(fontSize - 1);
            doc.text(
                "version Documento: " + version,
                doc.internal.pageSize.width / 2,
                289,
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
            format: [215, 297]
        });




        doc.setFont('helvetica', 'normal')
        doc.setFontSize(fontSize);

        let n = 1
        let i = 0

        let pos = 97

        //datos de cabecera

        addHeaders(doc);

        //FOTOGRAFIA DE LOGO  
        //doc.addImage(logo, 'JPEG', 8, l * 2 + 0.5, 38, 23)

        //FOTOGRAFIA DE BACKGROUND  
        //  doc.addImage(back, 'JPEG', m, l * 14, 200, 200)

        //fin datos de cabecera




        let z = 60
        let d = 0

        doc.addImage(back, 'JPEG', m, z + 4, 201, 190)

        checkpoints.map((check) => {


            const imgProps = doc.getImageProperties(check.z_imagen1);
            const width = imgProps.width;
            const height = imgProps.height;


            return (
                <>


                    {/*  cuadro principal   */}
                    {/*doc.rect(m, z, 201, l * 23)*/}

                    {z = z + 18}
                    {/*  titulo   */}
                    {doc.setFont('helvetica', 'bold')}
                    {doc.text(m + 100, z + 3, 'ITEM DE REPORTE', { align: "center" })}
                    {doc.setFont('helvetica', 'normal')}
                    {doc.rect(m, z, 201, 4)  /*x,y,ancho,alto */}

                    {z = z + 5}
                    {doc.setFont('helvetica', 'bold')}
                    {doc.text(m + 1, z + 3, 'Tipo de reporte', { align: "left" })}
                    {doc.setFont('helvetica', 'normal')}
                    {doc.rect(m, z, 35, 4)  /*x,y,ancho,alto */}
                    {doc.text(m + 36, z + 3, '' + check.tipo, { align: "left" })}
                    {doc.rect(m + 35, z, 65, 4)  /*x,y,ancho,alto */}

                    {d = 100}
                    {doc.setFont('helvetica', 'bold')}
                    {doc.text(m + 1 + d, z + 3, 'Fecha/hora de emision', { align: "left" })}
                    {doc.setFont('helvetica', 'normal')}
                    {doc.rect(m + d, z, 35, 4)  /*x,y,ancho,alto */}
                    {doc.text(m + 36 + d, z + 3, '' + fecha(check.emision), { align: "left" })}
                    {doc.rect(m + 35 + d, z, 66, 4)  /*x,y,ancho,alto */}

                    {z = z + 4}
                    {doc.setFont('helvetica', 'bold')}
                    {doc.text(m + 1, z + 3, 'Creado por', { align: "left" })}
                    {doc.setFont('helvetica', 'normal')}
                    {doc.rect(m, z, 35, 4)  /*x,y,ancho,alto */}
                    {doc.text(m + 36, z + 3, 'USUARIO DE SISTEMA', { align: "left" })}
                    {doc.rect(m + 35, z, 65, 4)  /*x,y,ancho,alto */}

                    {d = 100}
                    {doc.setFont('helvetica', 'bold')}
                    {doc.text(m + 1 + d, z + 3, '-', { align: "left" })}
                    {doc.setFont('helvetica', 'normal')}
                    {doc.rect(m + d, z, 35, 4)  /*x,y,ancho,alto */}
                    {doc.text(m + 36 + d, z + 3, '-', { align: "left" })}
                    {doc.rect(m + 35 + d, z, 66, 4)  /*x,y,ancho,alto */}

                    {z = z + 5}
                    {doc.setFont('helvetica', 'bold')}
                    {doc.text(m + 100, z + 3, 'DESCRIPCION DE PUNTO DE CONTROL', { align: "center" })}
                    {doc.setFont('helvetica', 'normal')}
                    {doc.rect(m, z, 201, 4)  /*x,y,ancho,alto */}

                    {z = z + 4}
                    {doc.setFont('helvetica', 'normal')}
                    {doc.text(m + 100, z + 3, '' + check.descripcion, { align: "center", maxWidth: 190 })}
                    {doc.rect(m, z, 201, 16)  /*x,y,ancho,alto */}



                    {z = z + 4}


                    {doc.rect(m, z + 17, 201, 128)  /*x,y,ancho,alto */}



                    {doc.addImage(check.z_imagen1, 'JPEG', m + 5, z + 20, 190, 120)}


                    {z = 60}
                    {doc.addPage()}

                    {doc.addImage(back, 'JPEG', m, z + 4, 201, 190)}




                </>
            )
        })


        { doc.setFont('helvetica', 'bold') }
        { doc.rect(m, l * 19, 201, l * 1) }
        { doc.text(m + 100, l * 19 + 3, 'RESUMEN DE REPORTES DE SERVICIO', { align: "center" }) }
        { doc.setFont('helvetica', 'normal') }


        let ll = 3.2
        checkpoints.map((check) => {
            return (
                <>


                    {doc.rect(m, l * (17 + ll), 25, l * 1)}
                    {doc.text(m + 1, l * (17 + ll) + 3, 'Emision', { align: "left" })}


                    {doc.rect(m + 25, l * (17 + ll), 75, l * 1)}
                    {doc.text(m + 1 + 25 + 1, l * (17 + ll) + 3, '' + fecha(check.emision), { align: "left" })}


                    {doc.rect(m + 100, l * (17 + ll), 25, l * 1)}
                    {doc.text(m + 1 + 100, l * (17 + ll) + 3, 'Tipo de registro', { align: "left" })}


                    {doc.rect(m + 125, l * (17 + ll), 76, l * 1)}
                    {doc.text(m + 125 + 1, l * (17 + ll) + 3, '' + check.tipo, { align: "left" })}

                    {doc.rect(m, l * (17 + ll + 1), 201, l * 3)}
                    {doc.text(m + 1, l * (17 + ll + 1) + 3, '' + check.descripcion, { align: "left", maxWidth: 175 })}



                    {doc.addImage(check.z_imagen1, 'JPEG', m + 180, l * (17 + ll + 1) + 1, 20, 10)}

                    {ll = ll + 5}

                </>
            )
        })






        //bloque de recepcion

        { doc.setFont('helvetica', 'bold') }
        doc.rect(m, l * 60, 49, l * 1)
        doc.text(m + 25, l * 60 + 3, 'SUPERVISOR DE SERVICIO', { align: "center" })
        { doc.setFont('helvetica', 'normal') }
        doc.rect(m, l * 61, 49, l * 1)
        doc.rect(m, l * 61, 49, l * 6)//cuadro de firma
        doc.text(m + 25, l * 61 + 3, '' + reporte.supervisor, { align: "center" })
        doc.text(m + 25, l * 67 + 3, 'FIRMA', { align: "center" })
        doc.rect(m, l * 67, 49, l * 1)
        let xx = 50
        { doc.setFont('helvetica', 'bold') }
        doc.rect(m + xx, l * 60, 49, l * 1)
        doc.text(m + 25 + xx, l * 60 + 3, 'PREVENCIONISTA', { align: "center" })
        { doc.setFont('helvetica', 'normal') }
        doc.rect(m + xx, l * 61, 49, l * 6)
        doc.rect(m + xx, l * 62, 49, l * 6)
        doc.text(m + 25 + xx, l * 61 + 3, '' + reporte.apr, { align: "center" })
        doc.text(m + 25 + xx, l * 67 + 3, 'FIRMA', { align: "center" })
        doc.rect(m + xx, l * 67, 49, l * 1)
        xx = xx + 50
        { doc.setFont('helvetica', 'bold') }
        doc.rect(m + xx, l * 60, 49, l * 1)
        doc.text(m + 25 + xx, l * 60 + 3, 'ADMINISTRADOR DE CONTRATO', { align: "center" })
        { doc.setFont('helvetica', 'normal') }
        doc.rect(m + xx, l * 61, 49, l * 6)
        doc.rect(m + xx, l * 62, 49, l * 6)
        doc.text(m + 25 + xx, l * 61 + 3, '' + reporte.adm, { align: "center" })
        doc.text(m + 25 + xx, l * 67 + 3, 'FIRMA', { align: "center" })
        doc.rect(m + xx, l * 67, 49, l * 1)
        xx = xx + 50
        { doc.setFont('helvetica', 'bold') }
        doc.rect(m + xx, l * 60, 49, l * 1)
        doc.text(m + 25 + xx, l * 60 + 3, 'MANDANTE', { align: "center" })
        { doc.setFont('helvetica', 'normal') }
        doc.rect(m + xx, l * 61, 49, l * 6)
        doc.rect(m + xx, l * 62, 49, l * 6)
        doc.text(m + 25 + xx, l * 61 + 3, '' + reporte.mandante, { align: "center" })
        doc.text(m + 25 + xx, l * 67 + 3, 'FIRMA', { align: "center" })
        doc.rect(m + xx, l * 67, 49, l * 1)








        //fin de bloque de recepcion 

        // Save the Data
        addHeaders(doc);
        addFooters(doc);
        doc.output('save', reporte.servicio + ' ' + reporte.tiposervicio + ' ' + reporte.mandante + ' ' + fecha2(reporte.emision) + '.pdf');

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


