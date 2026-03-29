import { Button, Card, FormControl, FormLabel, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material'
import { useFormik } from 'formik'

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router';

import * as yup from 'yup';
import { forwardRef, useEffect, useState } from 'react';

import { format, milliseconds, parse } from 'date-fns';

import Swal from 'sweetalert2';
import { imagenb64 } from '../../Services/Imagenes';
import { areas_redux, open_back, sectores_redux } from '../../Redux/ComDuks';

import { LocalizationProvider, MobileDateTimePicker, PickersTextField } from '@mui/x-date-pickers';
// If you are using date-fns v3.x or v4.x, please import `AdapterDateFns`
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { guardarCheckPoint } from '../../Services/Checkpoints';
import { guardarArea, guardarSector } from '../../Services/Empresas';
import { LoadAreas, LoadSectores } from '../../Services/CommonService';








//import { verificarPermisos } from '../../Services/Firebase';

const validationSchema = yup.object({
    //.matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/,'Debe ser en formato xx.xxx.xxx-x')
    // run: yup.string().required('Este campo es requerido').matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/, 'Debe ser en formato xx.xxx.xxx-x')
    // dato: yup.string().required('Este campo es requerido')
});


export default function SectorAdd() {


    let dispath = useDispatch()
    let location = useLocation()
    let navigate = useNavigate()

    let areas_r = useSelector(almacen => almacen.commons.areas_redux)
    const [areas, setAreas] = useState([])


    useEffect(() => {

        dispath(open_back(true, 'Actualizando lista de areas'))
        LoadAreas().then((r) => {
            dispath(areas_redux(r))


            dispath(open_back(false, 'Actualizando lista de areas'))
        })



    }, [])


    useEffect(() => {

        areasfilter()

    }, [areas_r])



    const areasfilter = () => {
        setAreas(areas_r.filter(opcion => opcion.empresa == location.state.id))
    }


    let mar = '0px 5px 0px 2px'//top, r,b,l  

    //---------------------Funciones de usuario-----------------------
    const formik = useFormik({
        initialValues: {
            //---------------------valores de formik----------------------
            emision: Date.now(),
            empresa: location.state.id,
            sector: '',
            descripcion: 'SIN DESCRIPCION',





            //---------------------fin valores de formik------------------
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {

            dispath(open_back(true, 'Guardando sector'))

            guardarSector(values).then(() => {


                dispath(open_back(true, 'Actualizando'))

                LoadSectores().then((r) => {
                    dispath(sectores_redux(r))

                    navigate('/empresas')
                    dispath(open_back(false, 'Actualizando'))
                })


            })





        },
    });










    return (
        <>
            <Card style={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>REGISTRAR NUEVO SECTOR DE SERVICIO A <br /> {location.state.id}</b>
                </Typography>

                <form onSubmit={formik.handleSubmit}>

                    {/*-------------Inicio de grid container------------------*/}
                    <Grid container spacing={1}>



                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 3 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl fullWidth>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Area de servicio</FormLabel>
                                <Select
                                    labelId='larea'
                                    name='area'
                                    id='area'
                                    value={formik.values.area}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Area de servicio'
                                    onChange={(e) => {

                                        formik.setFieldValue('area', e.target.value)

                                        //setSectores([{ sector: 'SIN VALOR SELECCIONADO' }])



                                    }
                                    }
                                    onClick={() => {



                                    }}>

                                    {areas.map((opcion) => {
                                        return (<MenuItem value={opcion.area}>{opcion.area}</MenuItem>)
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}



                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Sector a registrar</FormLabel>
                                <TextField
                                    id='sector'
                                    name='sector'
                                    size='small'
                                    rows={1}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.sector}
                                    onChange={formik.handleChange}
                                    error={formik.touched.sector && Boolean(formik.errors.sector)}
                                    helperText={formik.touched.sector && formik.errors.sector}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}













                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 12, lg: 12 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Descripcion de sector</FormLabel>
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