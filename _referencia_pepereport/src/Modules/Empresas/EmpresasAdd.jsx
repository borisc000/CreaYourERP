import { Button, Card, FormControl, FormLabel, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material'
import { useFormik } from 'formik'

import { useDispatch } from 'react-redux';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';

import * as yup from 'yup';
import { forwardRef, useEffect, useState } from 'react';

import { format, milliseconds, parse } from 'date-fns';

import Swal from 'sweetalert2';
import { imagenb64 } from '../../Services/Imagenes';
import { empresas_redux, open_back } from '../../Redux/ComDuks';

import { LocalizationProvider, MobileDateTimePicker, PickersTextField } from '@mui/x-date-pickers';
// If you are using date-fns v3.x or v4.x, please import `AdapterDateFns`
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { guardarCheckPoint } from '../../Services/Checkpoints';
import { guardarArea, guardarEmpresa } from '../../Services/Empresas';
import { LoadEmpresas } from '../../Services/CommonService';








//import { verificarPermisos } from '../../Services/Firebase';

const validationSchema = yup.object({
    //.matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/,'Debe ser en formato xx.xxx.xxx-x')
    // run: yup.string().required('Este campo es requerido').matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/, 'Debe ser en formato xx.xxx.xxx-x')
    // dato: yup.string().required('Este campo es requerido')
});


export default function EmpresasAdd() {


    let dispath = useDispatch()
    let location = useLocation()
    let navigate = useNavigate()



    let mar = '0px 5px 0px 2px'//top, r,b,l  

    //---------------------Funciones de usuario-----------------------
    const formik = useFormik({
        initialValues: {
            //---------------------valores de formik----------------------
            emision: Date.now(),

            empresa: '',
            descripcion: 'SIN DESCRIPCION',





            //---------------------fin valores de formik------------------
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {

            dispath(open_back(true, 'Registrando empresa'))
            guardarEmpresa(values).then(() => {

                dispath(open_back(true, 'Actualizando'))


                LoadEmpresas().then((r) => {

                    dispath(empresas_redux(r))
                    dispath(open_back(false, 'Registrada'))

                    navigate('/empresas')
                })




            })





        },
    });










    return (
        <>
            <Card style={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>REGISTRAR EMPRESA</b>
                </Typography>

                <form onSubmit={formik.handleSubmit}>

                    {/*-------------Inicio de grid container------------------*/}
                    <Grid container spacing={1}>


                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Nombre de empresa</FormLabel>
                                <TextField
                                    id='empresa'
                                    name='empresa'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.empresa}
                                    onChange={formik.handleChange}
                                    error={formik.touched.empresa && Boolean(formik.errors.empresa)}
                                    helperText={formik.touched.empresa && formik.errors.empresa}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}













                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 12, lg: 12 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Descripcion de area</FormLabel>
                                <TextField
                                    id='descripcion'
                                    name='descripcion'
                                    size='small'
                                    rows={2}
                                    multiline

                                    required
                                    sx={{ backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.descripcion}
                                    onChange={formik.handleChange}
                                    error={formik.touched.descripcion && Boolean(formik.errors.descripcion)}
                                    helperText={formik.touched.descripcion && formik.errors.descripcion}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}

                    </Grid>
                    {/*-------------Termino de grid container-----------------*/}


                    <Grid container spacing={0} style={{ margin: 0 }}>
                        {/*-----------------------------------------------------------------------------*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} style={{ padding: 2 }}></Grid>

                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} sx={{ p: 1, mt: 2 }}>
                            <Button variant='contained' size='small' color="success" fullWidth type="submit">Registrar sector</Button>
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