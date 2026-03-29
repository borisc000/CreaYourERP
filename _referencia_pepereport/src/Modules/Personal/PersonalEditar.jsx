import { Button, Card, FormControl, FormLabel, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material'
import { useFormik } from 'formik'

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router';

import * as yup from 'yup';
import { useEffect, useState } from 'react';
import { ActualizarPersonal, BuscarRun, GuardarPersonal } from '../../Services/Personal';
import { open_back, personal_redux } from '../../Redux/ComDuks';
import { LoadPersonal } from '../../Services/CommonService';



//import { verificarPermisos } from '../../Services/Firebase';

const validationSchema = yup.object({
    //.matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/,'Debe ser en formato xx.xxx.xxx-x')
    //  run: yup.string().required('Este campo es requerido').matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/, 'Debe ser en formato xx.xxx.xxx-x')
    // dato: yup.string().required('Este campo es requerido')
});


export default function PersonalEditar() {


    let dispath = useDispatch()
    let params = useParams()
    let navigate = useNavigate()
    let location = useLocation()


    let cargos_r = useSelector(almacen => almacen.commons.cargos_redux)

    const [foto, setFoto] = useState(localStorage.getItem('nofoto'))

    let mar = '2px 2px 2px 2px'//top, r,b,l  





    //---------------------Funciones de usuario-----------------------
    const formik = useFormik({
        initialValues: {
            //---------------------valores de formik----------------------
            run: location.state.run,
            pnombre: '',
            snombre: '',
            apppat: '',
            appmat: '',
            cargo: '',



            //---------------------fin valores de formik------------------
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {


            dispath(open_back(true, 'Guardando personal'))
            ActualizarPersonal(values).then((r) => {
                dispath(open_back(true, 'Actualizando'))


                LoadPersonal().then((r) => {
                    dispath(open_back(false, 'actualizando'))
                    dispath(personal_redux(r))
                    navigate('/personal/index')
                })







            })

        },
    });



    useEffect(() => {


        dispath(open_back(true, 'cargando datos'))
        BuscarRun(location.state.run).then((r) => {

            formik.setFieldValue("id", r.id)
            formik.setFieldValue("pnombre", r.pnombre)
            formik.setFieldValue("snombre", r.snombre)
            formik.setFieldValue("apppat", r.apppat)
            formik.setFieldValue("appmat", r.appmat)
            formik.setFieldValue("cargo", r.cargo)

            dispath(open_back(true, 'Actualizando...'))
            LoadPersonal().then((r) => {

                dispath(personal_redux(r))

            })



            dispath(open_back(false, 'cargando datos'))

        })


    }, [])




    return (
        <>
            <Card sx={{ minWidth: 275, minHeight: 100, p: 1, m: 1, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>Registrar nuevo personal (run : {location.state.run})</b>
                </Typography>



                <form onSubmit={formik.handleSubmit}>

                    {/*-------------Inicio de grid container------------------*/}
                    <Grid container spacing={1}>
                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Run a registrar</FormLabel>
                                <TextField
                                    id='runx'
                                    name='runx'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={location.state.run}


                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}
                    </Grid>

                    <Grid container spacing={1}>
                        {/*---------Inicio de grid item----------*/}


                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 3 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Primer Nombre</FormLabel>
                                <TextField
                                    id='pnombre'
                                    name='pnombre'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.pnombre}
                                    onChange={formik.handleChange}
                                    error={formik.touched.pnombre && Boolean(formik.errors.pnombre)}
                                    helperText={formik.touched.pnombre && formik.errors.pnombre}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}




                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 3 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Segundo nombre</FormLabel>
                                <TextField
                                    id='snombre'
                                    name='snombre'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.snombre}
                                    onChange={formik.handleChange}
                                    error={formik.touched.snombre && Boolean(formik.errors.snombre)}
                                    helperText={formik.touched.snombre && formik.errors.snombre}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}


                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 3 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Apellido paterno</FormLabel>
                                <TextField
                                    id='apppat'
                                    name='apppat'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.apppat}
                                    onChange={formik.handleChange}
                                    error={formik.touched.apppat && Boolean(formik.errors.apppat)}
                                    helperText={formik.touched.apppat && formik.errors.apppat}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}


                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 3 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Apellido materno</FormLabel>
                                <TextField
                                    id='appmat'
                                    name='appmat'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.appmat}
                                    onChange={formik.handleChange}
                                    error={formik.touched.appmat && Boolean(formik.errors.appmat)}
                                    helperText={formik.touched.appmat && formik.errors.appmat}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}


                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl fullWidth>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Cargo</FormLabel>
                                <Select
                                    labelId='lcargo'
                                    name='cargo'
                                    id='cargo'
                                    value={formik.values.cargo}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Cargo' onChange={formik.handleChange}>
                                    <MenuItem value={formik.values.cargo}>{formik.values.cargo}</MenuItem>
                                    {cargos_r.map((opcion) => {
                                        return (<MenuItem value={opcion.cargo}>{opcion.cargo}</MenuItem>)
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}









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