import { Button, Card, FormControl, FormLabel, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material'
import { useFormik } from 'formik'

import { useDispatch } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router';

import * as yup from 'yup';
import { forwardRef, useEffect, useState } from 'react';

import { format, milliseconds, parse } from 'date-fns';

import Swal from 'sweetalert2';
import { imagenb64 } from '../../Services/Imagenes';
import { open_back, tiposervicios_redux } from '../../Redux/ComDuks';

import { LocalizationProvider, MobileDateTimePicker, PickersTextField } from '@mui/x-date-pickers';
// If you are using date-fns v3.x or v4.x, please import `AdapterDateFns`
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { guardarCheckPoint } from '../../Services/Checkpoints';
import { guardartiposdeservicios } from '../../Services/Empresas';
import { LoadTiposervicios } from '../../Services/CommonService';








//import { verificarPermisos } from '../../Services/Firebase';

const validationSchema = yup.object({
    //.matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/,'Debe ser en formato xx.xxx.xxx-x')
    // run: yup.string().required('Este campo es requerido').matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/, 'Debe ser en formato xx.xxx.xxx-x')
    // dato: yup.string().required('Este campo es requerido')
});


export default function Miscelaneos() {


    let dispath = useDispatch()
    let params = useParams()
    let navigate = useNavigate()
    let location = useLocation()



    useEffect(() => {


    }, [])



    const [foto, setFoto] = useState(localStorage.getItem('nofoto'))

    let mar = '2px 2px 2px 2px'//top, r,b,l  

    //---------------------Funciones de usuario-----------------------
    const formik = useFormik({
        initialValues: {
            //---------------------valores de formik----------------------

            servicio: '',
            //---------------------fin valores de formik------------------
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {
            dispath(open_back(true, 'Guardando servicio'))
            guardartiposdeservicios(values).then(() => {
                Swal.fire({
                    title: "¡Listo!",
                    icon: "success",
                    draggable: true
                });
                formik.setFieldValue("servicio", '')

                LoadTiposervicios().then((r) => {
                    dispath(tiposervicios_redux(r))


                    dispath(open_back(false, 'Finalizado'))

                })



            })


        },
    });







    return (
        <>
            <Card sx={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1, fontWeight: 'bold' }} color='text.secondary' gutterBottom>
                    REGISTRO DE OTROS TIPOS DE DATOS
                </Typography>

                <form onSubmit={formik.handleSubmit}>

                    {/*-------------Inicio de grid container------------------*/}
                    <Grid container spacing={1}>



                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Registrar nuevo tipo de servicio</FormLabel>
                                <TextField
                                    id='servicio'
                                    name='servicio'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.servicio}
                                    onChange={formik.handleChange}
                                    error={formik.touched.servicio && Boolean(formik.errors.servicio)}
                                    helperText={formik.touched.servicio && formik.errors.servicio}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}



                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} sx={{ p: 1, mt: 2 }}>
                            <Button variant='contained' size='small' color="success" fullWidth type="submit">Registrar</Button>
                        </Grid>
                        {/*-------------Termino de grid item*/}










                    </Grid>
                    {/*-------------Termino de grid container-----------------*/}


                    <Grid container spacing={0} sx={{ m: 0 }}>
                        {/*-----------------------------------------------------------------------------*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} style={{ padding: 2 }}></Grid>


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