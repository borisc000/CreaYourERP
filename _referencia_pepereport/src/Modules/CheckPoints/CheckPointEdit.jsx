import { Button, Card, FormControl, FormLabel, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material'
import { useFormik } from 'formik'

import { useDispatch } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router';

import * as yup from 'yup';
import { forwardRef, useEffect, useState } from 'react';

import { format, milliseconds, parse } from 'date-fns';

import Swal from 'sweetalert2';
import { imagenb64 } from '../../Services/Imagenes';
import { open_back } from '../../Redux/ComDuks';

import { LocalizationProvider, MobileDateTimePicker, PickersTextField } from '@mui/x-date-pickers';
// If you are using date-fns v3.x or v4.x, please import `AdapterDateFns`
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ActualizarCheckPoint, CargarCheckpoint } from '../../Services/Checkpoints';

import { es } from 'date-fns/locale';






//import { verificarPermisos } from '../../Services/Firebase';

const validationSchema = yup.object({
    //.matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/,'Debe ser en formato xx.xxx.xxx-x')
    // run: yup.string().required('Este campo es requerido').matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/, 'Debe ser en formato xx.xxx.xxx-x')
    // dato: yup.string().required('Este campo es requerido')
});


export default function CheckPointEdit() {


    let dispath = useDispatch()
    let params = useParams()
    let navigate = useNavigate()
    let location = useLocation()

    const [tipopunto, setTipopunto] = useState(['TERMINO', 'EMERGENCIA'])
    let check = JSON.parse(localStorage.getItem("checkpoints"))

    useEffect(() => {


        console.log(check.length)
        if (check.length == 0) {
            setTipopunto(['INICIAL'])
        } else {
            setTipopunto(['CONTROL', 'EMERGENCIA', 'ESPECIAL', 'ENTREGA', 'CONTINUIDAD'])
        }

    }, [])



    const [foto, setFoto] = useState(localStorage.getItem('nofoto'))

    let mar = '0px 5px 0px 2px'//top, r,b,l  

    //---------------------Funciones de usuario-----------------------
    const formik = useFormik({
        initialValues: {
            //---------------------valores de formik----------------------
            emision: Date.now(),
            idas: location.state.id,
            cdate: '',
            tipo: '',
            z_imagen1: foto


            //---------------------fin valores de formik------------------
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {




            dispath(open_back(true, 'Guardando punto de control'))
            ActualizarCheckPoint(values).then((r) => {
                Swal.fire({
                    title: "¡Listo!",
                    icon: "success",
                    draggable: true
                });



                navigate('/reportes/editar', { state: { id: values.idas } })

            })


        },
    });





    useEffect(() => {

        dispath(open_back(true, 'Cargando checkpoint'))


        CargarCheckpoint(location.state.id).then((r) => {




            formik.setFieldValue('id', r.id)
            formik.setFieldValue('idas', r.idas)
            formik.setFieldValue('emision', parseInt(r.emision))
            formik.setFieldValue('cdate', r.cdate)
            formik.setFieldValue('descripcion', r.descripcion)
            formik.setFieldValue('tipo', r.tipo)
            formik.setFieldValue('z_imagen1', r.z_imagen1)

            setFoto(r.z_imagen1)

            dispath(open_back(false, 'Cargando checkpoint'))
            localStorage.setItem('checkpoint', JSON.stringify(r))



        })

    }, [])






    return (
        <>
            <Card style={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>EDITAR PUNTO DE CONTROL</b>
                </Typography>



                <form onSubmit={formik.handleSubmit}>

                    {/*-------------Inicio de grid container------------------*/}
                    <Grid container spacing={1}>







                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 3 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.2, }}>Emision</FormLabel>
                                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
                                    <MobileDateTimePicker
                                        formatDensity="dense"

                                        fullWidth slotProps={{ textField: { size: 'small', maxWidth: '100%' } }}

                                        onChange={(e) => {


                                            let tr = format(new Date(e), "T")
                                            formik.setFieldValue("emision", new Date(e))

                                            console.log(tr)


                                        }}

                                        value={formik.values.emision}
                                        defaultValue={Date.now()}
                                    />
                                </LocalizationProvider>


                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}



                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 6, md: 6, lg: 2 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.2, }}>Id asociado</FormLabel>
                                <TextField
                                    id='idas'
                                    name='idas'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
                                    value={formik.values.idas}
                                    onChange={formik.handleChange}
                                    error={formik.touched.idas && Boolean(formik.errors.idas)}
                                    helperText={formik.touched.idas && formik.errors.idas}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}

                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl fullWidth>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Tipo de punto</FormLabel>
                                <Select
                                    labelId='ltipo'
                                    name='tipo'
                                    id='tipo'
                                    value={formik.values.tipo}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Tipo de punto' onChange={formik.handleChange}>

                                    <MenuItem disabled value={'INICIAL'}>{'INICIAL'}</MenuItem>

                                    {formik.values.tipo != 'INICIAL' ? (
                                        tipopunto.map((el) => {
                                            return (
                                                <MenuItem value={el}>{el}</MenuItem>
                                            )

                                        })
                                    ) : ('')}






                                    {/*---------Termino de grid item select----------*/}

                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}




                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 12, lg: 12 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Descripcion de punto de control</FormLabel>
                                <TextField
                                    id='descripcion'
                                    name='descripcion'
                                    size='small'
                                    rows={2}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.descripcion}
                                    onChange={formik.handleChange}
                                    error={formik.touched.descripcion && Boolean(formik.errors.descripcion)}
                                    helperText={formik.touched.descripcion && formik.errors.descripcion}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}





                        {/*-------------Inicio de grid item------------------*/}
                        <Grid size={{ xs: 12, md: 12, lg: 12 }} style={{ padding: 1 }}>



                            <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                                <b>carga de imagen desde web</b>
                            </Typography>

                            <Button fullWidth component="label" onChange={(e) => {

                                imagenb64(e).then((r) => {
                                    setFoto(r)
                                    formik.setFieldValue('z_imagen1', r)
                                })

                            }}>
                                <br />

                                <br />
                                <input type="file" hidden accept="image/png, image/jpeg" />
                                <img src={foto} style={{ maxHeight: 250, maxWidth: 250 }} />


                            </Button>


                        </Grid>
                        {/*-------------Termino de grid item------------------*/}





                    </Grid>
                    {/*-------------Termino de grid container-----------------*/}


                    <Grid container spacing={0} style={{ margin: 0 }}>
                        {/*-----------------------------------------------------------------------------*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} style={{ padding: 2 }}></Grid>

                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} sx={{ p: 1, mt: 2 }}>
                            <Button variant='contained' size='small' color="success" fullWidth type="submit">Actualizar datos</Button>
                        </Grid>
                        {/*-------------Termino de grid item*/}

                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} sx={{ p: 1, mt: 2 }}>
                            <Button variant='contained' size='small' color="success" fullWidth onClick={() => {
                                navigate('/reportes/editar', { state: { id: formik.values.idas } })
                            }}>Regresar</Button>
                        </Grid>
                        {/*-------------Termino de grid item*/}


                    </Grid>
                    {/*-----------------------------------------------------------------------------*/}

                </form>

            </Card >




        </>
    )
}