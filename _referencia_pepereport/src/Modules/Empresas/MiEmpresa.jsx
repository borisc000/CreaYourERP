import { Button, Card, FormControl, FormLabel, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material'
import { useFormik } from 'formik'

import { useDispatch } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router';

import * as yup from 'yup';
import { forwardRef, useEffect, useState } from 'react';

import { format, milliseconds, parse } from 'date-fns';

import Swal from 'sweetalert2';
import { imagenb64, imagenb64v2 } from '../../Services/Imagenes';
import { open_back } from '../../Redux/ComDuks';

import { LocalizationProvider, MobileDateTimePicker, PickersTextField } from '@mui/x-date-pickers';
// If you are using date-fns v3.x or v4.x, please import `AdapterDateFns`
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { guardarCheckPoint } from '../../Services/Checkpoints';
import { CargarComunes, GuardarComunes } from '../../Services/CommonService';
import { cargar_comunes } from '../../Services/Firebase';








//import { verificarPermisos } from '../../Services/Firebase';

const validationSchema = yup.object({
    //.matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/,'Debe ser en formato xx.xxx.xxx-x')
    // run: yup.string().required('Este campo es requerido').matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/, 'Debe ser en formato xx.xxx.xxx-x')
    // dato: yup.string().required('Este campo es requerido')
});


export default function MiEmpresa() {


    let dispath = useDispatch()
    let params = useParams()
    let navigate = useNavigate()
    let location = useLocation()







    const [foto1, setFoto1] = useState(localStorage.getItem('nofoto'))
    const [foto2, setFoto2] = useState(localStorage.getItem('nofoto'))

    let mar = '2px 2px 2px 2px'//top, r,b,l  

    //---------------------Funciones de usuario-----------------------
    const formik = useFormik({
        initialValues: {
            //---------------------valores de formik----------------------
            e_01: '',
            e_02: '',
            e_03: '',
            e_04: '',
            e_05: '',
            e_06: '',

            z_01: foto1,
            z_02: foto2,


            //---------------------fin valores de formik------------------
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {

            dispath(open_back(true, 'Guardando datos de empresa'))
            GuardarComunes(values).then(() => {
                Swal.fire({
                    title: "¡Listo!",
                    icon: "success",
                    draggable: true
                });


                dispath(open_back(true, 'Actualizando informacion'))


                cargar_comunes().then(() => {
                    dispath(open_back(false, 'Finalizado'))
                })
                //navigate('/reportes/editar', { state: { id: location.state.id } })

            })


        },
    });



    useEffect(() => {

        dispath(open_back(true, "Cargando datos, por favor espere"))

        CargarComunes().then((r) => {
            formik.setFieldValue('e_01', r.e_01)
            formik.setFieldValue('e_02', r.e_02)
            formik.setFieldValue('e_03', r.e_03)
            formik.setFieldValue('e_04', r.e_04)
            formik.setFieldValue('e_05', r.e_05)
            formik.setFieldValue('e_06', r.e_06)

            formik.setFieldValue('z_01', r.z_01)
            formik.setFieldValue('z_02', r.z_02)
            setFoto1(r.z_01)
            setFoto2(r.z_02)


            dispath(open_back(true, "Actualizando el almacenamiento"))

            cargar_comunes().then(() => {
                dispath(open_back(false, "Cargando datos, por favor espere"))
            })


        })

    }, [])




    return (
        <>
            <Card sx={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>Datos globales de empresa</b>
                </Typography>

                <form onSubmit={formik.handleSubmit}>

                    {/*-------------Inicio de grid container------------------*/}
                    <Grid container spacing={1}>


                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Nombre de empresa</FormLabel>
                                <TextField
                                    id='e_01'
                                    name='e_01'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.e_01}
                                    onChange={formik.handleChange}
                                    error={formik.touched.e_01 && Boolean(formik.errors.e_01)}
                                    helperText={formik.touched.e_01 && formik.errors.e_01}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}

                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>R.U.T</FormLabel>
                                <TextField
                                    id='e_02'
                                    name='e_02'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.e_02}
                                    onChange={formik.handleChange}
                                    error={formik.touched.e_02 && Boolean(formik.errors.e_02)}
                                    helperText={formik.touched.e_02 && formik.errors.e_02}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}

                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Giros</FormLabel>
                                <TextField
                                    id='e_03'
                                    name='e_03'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.e_03}
                                    onChange={formik.handleChange}
                                    error={formik.touched.e_03 && Boolean(formik.errors.e_03)}
                                    helperText={formik.touched.e_03 && formik.errors.e_03}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}


                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Correo electronico y contacto</FormLabel>
                                <TextField
                                    id='e_04'
                                    name='e_04'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.e_04}
                                    onChange={formik.handleChange}
                                    error={formik.touched.e_04 && Boolean(formik.errors.e_04)}
                                    helperText={formik.touched.e_04 && formik.errors.e_04}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}


                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Administrador de contrato</FormLabel>
                                <TextField
                                    id='e_05'
                                    name='e_05'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.e_05}
                                    onChange={formik.handleChange}
                                    error={formik.touched.e_05 && Boolean(formik.errors.e_05)}
                                    helperText={formik.touched.e_05 && formik.errors.e_05}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}

                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Numero de contacto</FormLabel>
                                <TextField
                                    id='e_06'
                                    name='e_06'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.e_06}
                                    onChange={formik.handleChange}
                                    error={formik.touched.e_06 && Boolean(formik.errors.e_06)}
                                    helperText={formik.touched.e_06 && formik.errors.e_06}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}













                        {/*-------------Inicio de grid item------------------*/}
                        <Grid size={{ xs: 12, md: 12, lg: 6 }} style={{ padding: 1 }}>
                            <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                                <b>Logo de empresa (230x140 pixels)</b>
                            </Typography>

                            <Button fullWidth component="label" onChange={(e) => {
                                dispath(open_back(open, 'Cargando imagen'))
                                imagenb64v2(e).then((r) => {
                                    setFoto1(r)
                                    formik.setFieldValue('z_01', r)
                                    dispath(open_back(close, 'Cargando imagen'))
                                })

                            }}>
                                <input type="file" hidden accept="image/png, image/jpeg" />
                                <img src={foto1} style={{ maxHeight: 250, maxWidth: 250 }} />
                            </Button>


                        </Grid>
                        {/*-------------Termino de grid item------------------*/}



                        {/*-------------Inicio de grid item------------------*/}
                        <Grid size={{ xs: 12, md: 12, lg: 6 }} style={{ padding: 1 }}>
                            <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                                <b>Fondo de pagina (500 x 500 pixels)</b>
                            </Typography>

                            <Button fullWidth component="label" onChange={(e) => {
                                dispath(open_back(open, 'Cargando imagen'))
                                imagenb64v2(e).then((r) => {
                                    setFoto2(r)
                                    formik.setFieldValue('z_02', r)
                                    dispath(open_back(false, 'Cargando imagen'))
                                })

                            }}>
                                <input type="file" hidden accept="image/png, image/jpeg" />
                                <img src={foto2} style={{ maxHeight: 250, maxWidth: 250 }} />
                            </Button>


                        </Grid>
                        {/*-------------Termino de grid item------------------*/}









                    </Grid>
                    {/*-------------Termino de grid container-----------------*/}


                    <Grid container spacing={0} sx={{ m: 0 }}>
                        {/*-----------------------------------------------------------------------------*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} style={{ padding: 2 }}></Grid>

                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} sx={{ p: 1, mt: 2 }}>
                            <Button variant='contained' size='small' color="success" fullWidth type="submit">Actualizar datos</Button>
                        </Grid>
                        {/*-------------Termino de grid item*/}

                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} sx={{ p: 1, mt: 2 }}>

                        </Grid>
                        {/*-------------Termino de grid item*/}


                    </Grid>
                    {/*-----------------------------------------------------------------------------*/}

                </form>

            </Card >




        </>
    )
}