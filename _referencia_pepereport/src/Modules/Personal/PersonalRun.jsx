import { Button, Card, FormControl, FormLabel, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material'
import { useFormik } from 'formik'

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router';

import * as yup from 'yup';
import { useEffect, useState } from 'react';
import { BuscarRun } from '../../Services/Personal';
import Swal from 'sweetalert2';
import { open_back } from '../../Redux/ComDuks';

const validationSchema = yup.object({
    //.matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/,'Debe ser en formato xx.xxx.xxx-x')
    run: yup.string().required('Este campo es requerido').matches(/^(\d{1,3}(?:\.\d{1,3}){2}-[\dkK])$/, 'Debe ser en formato xx.xxx.xxx-x')
    // dato: yup.string().required('Este campo es requerido')
});


export default function PersonalRun() {


    let dispath = useDispatch()
    let params = useParams()
    let navigate = useNavigate()
    let location = useLocation()




    let mar = '2px 2px 2px 2px'//top, r,b,l  

    //---------------------Funciones de usuario-----------------------
    const formik = useFormik({
        initialValues: {
            //---------------------valores de formik----------------------


            //---------------------fin valores de formik------------------
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {


            dispath(open_back(true, 'Comprobando'))

            BuscarRun(values.run).then((r) => {

                console.log(r)

                if (r.run == values.run) {
                    Swal.fire({
                        title: "Este run ya se encuentra registrado, por favor verifique",
                        icon: "success",
                        draggable: true
                    });
                } else {
                    navigate('/personal/registrar', { state: { run: values.run } })
                }



                dispath(open_back(false, 'Guardando punto de control'))
            })


        },
    });







    return (
        <>
            <Card sx={{ minWidth: 275, minHeight: 80, p: 1, m: 1, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>Verificar Run</b>
                </Typography>

                <form onSubmit={formik.handleSubmit}>

                    {/*-------------Inicio de grid container------------------*/}
                    <Grid container spacing={1}>


                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Run a registrar</FormLabel>
                                <TextField
                                    id='run'
                                    name='run'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.run}
                                    onChange={formik.handleChange}
                                    error={formik.touched.run && Boolean(formik.errors.run)}
                                    helperText={formik.touched.run && formik.errors.run}
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