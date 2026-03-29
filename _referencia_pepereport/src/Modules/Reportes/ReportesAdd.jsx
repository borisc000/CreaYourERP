import { Autocomplete, Button, Card, FormControl, FormLabel, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material'
import { useFormik } from 'formik'

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router';

import * as yup from 'yup';
import { useEffect, useState } from 'react';

import Swal from 'sweetalert2';
import { open_back } from '../../Redux/ComDuks';
import { GuardarReporte } from '../../Services/Reportes';






//import { verificarPermisos } from '../../Services/Firebase';

const validationSchema = yup.object({
    //.matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/,'Debe ser en formato xx.xxx.xxx-x')
    // run: yup.string().required('Este campo es requerido').matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/, 'Debe ser en formato xx.xxx.xxx-x')
    // dato: yup.string().required('Este campo es requerido')
});


export default function ReportesAdd() {


    let dispath = useDispatch()
    let params = useParams()
    let navigate = useNavigate()
    let location = useLocation()



    const [foto, setFoto] = useState(localStorage.getItem('nofoto'))

    let mar = '2px 5px 5px 2px'//top, r,b,l  


    let personal_r = useSelector(almacen => almacen.commons.personal_redux)

    let empresas_r = useSelector(almacen => almacen.commons.empresas_redux)
    let areas_r = useSelector(almacen => almacen.commons.areas_redux)
    let sectores_r = useSelector(almacen => almacen.commons.sectores_redux)

    let mandantes_r = useSelector(almacen => almacen.commons.mandantes_redux)

    let tiposervicios_r = useSelector(almacen => almacen.commons.tiposervicios_redux)



    const [areas, setAreas] = useState([])
    const [sectores, setSectores] = useState([])
    const [apr, setApr] = useState([])
    const [supervisor, setsupervisor] = useState([])
    const [adm, setAdm] = useState([])
    const [mandante, setMandante] = useState([])




    useEffect(() => {
        setApr(personal_r.filter(personal => personal.cargo == 'APR'))
        setsupervisor(personal_r.filter(personal => personal.cargo == 'SUPERVISOR'))
        setAdm(personal_r.filter(personal => personal.cargo == 'ADC'))

    }, [personal_r])


    const areasfilter = (data) => {
        setAreas(areas_r.filter(opcion => opcion.empresa == data))
    }
    const sectoresfilter = (data) => {
        setSectores(sectores_r.filter(opcion => opcion.area == data))
    }


    //---------------------Funciones de usuario-----------------------
    const formik = useFormik({
        initialValues: {
            //---------------------valores de formik----------------------

            emision: Date.now(),
            apr: 'SIN VALOR SELECCIONADO',
            supervisor: 'SIN VALOR SELECCIONADO',
            adm: 'SIN VALOR SELECCIONADO',
            mandante: 'SIN VALOR SELECCIONADO',
            empresa: '',
            area: '',
            sector: '',
            servicio: '',
            tiposervicio: '',
            fdate: '',
            estado: '',


            //---------------------fin valores de formik------------------
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {

            dispath(open_back(true, 'Guardando reporte'))

            GuardarReporte(values).then((r) => {
                dispath(open_back(false, 'Guardando reporte'))
                Swal.fire({
                    title: "¡Listo!",
                    icon: "success",
                    draggable: true

                });

                navigate('/reportes/editar', { state: { id: r } })


            })






        },
    });











    return (
        <>
            <Card style={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>REGISTRO DE NUEVO REPORTE DE SERVICIO</b>
                </Typography>


                <form onSubmit={formik.handleSubmit}>

                    {/*-------------Inicio de grid container------------------*/}
                    <Grid container spacing={1}>




                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormLabel sx={{ ml: 1, pb: 0.5, }}>Empresa</FormLabel>
                            <Autocomplete
                                id='empresa'
                                name='empresa'
                                value={formik.values.empresa}
                                freeSolo
                                sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)' }}
                                size='small'
                                options={empresas_r.map((option) => option.empresa)}
                                onChange={(e) => {
                                    formik.setFieldValue('empresa', e.target.textContent)
                                    console.log(e.target.textContent)
                                    formik.setFieldValue('area', 'SIN VALOR SELECCIONADO')
                                    setAreas([{ area: 'SIN VALOR SELECCIONADO' }])
                                    areasfilter(e.target.textContent)

                                    formik.setFieldValue('sector', 'SIN VALOR SELECCIONADO')
                                    setSectores([])


                                }}
                                renderInput={(params) => <TextField sx={{ p: mar }} {...params} />} />
                        </Grid>
                        {/*---------Termino de grid item----------*/}



                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
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
                                        formik.setFieldValue('sector', 'SIN VALOR SELECCIONADO')
                                        //setSectores([{ sector: 'SIN VALOR SELECCIONADO' }])

                                        sectoresfilter(e.target.value)

                                    }
                                    }
                                    onClick={() => {



                                    }}>
                                    <MenuItem value={'SIN VALOR SELECCIONADO'}>SIN VALOR SELECCIONADO</MenuItem>
                                    {areas.map((opcion) => {
                                        return (<MenuItem value={opcion.area}>{opcion.area}</MenuItem>)
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}


                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl fullWidth>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Sector de servicio</FormLabel>
                                <Select
                                    labelId='lsector'
                                    name='sector'
                                    id='sector'
                                    value={formik.values.sector}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Sector'
                                    onChange={(e) => {
                                        formik.setFieldValue('sector', e.target.value)
                                    }
                                    }


                                >
                                    <MenuItem value={'SIN VALOR SELECCIONADO'}>SIN VALOR SELECCIONADO</MenuItem>
                                    {sectores.map((opcion) => {
                                        return (<MenuItem value={opcion.sector}>{opcion.sector}</MenuItem>)
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}

                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl fullWidth>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Tipo de servicio</FormLabel>
                                <Select
                                    labelId='ltiposervicio'
                                    name='tiposervicio'
                                    id='tiposervicio'
                                    value={formik.values.tiposervicio}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Tipo de servicio' onChange={formik.handleChange}>

                                    <MenuItem value={'SIN VALOR SELECCIONADO'}>SIN VALOR SELECCIONADO</MenuItem>
                                    {tiposervicios_r.map((opcion) => {
                                        return (<MenuItem value={opcion.valor}>{opcion.valor}</MenuItem>)
                                    })}

                                    {/*---------Termino de grid item select----------*/}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}


                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 12, lg: 12 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '99%' }}>
                                <FormLabel sx={{ ml: 1 }}>Descripcion de servicio</FormLabel>
                                <TextField
                                    id='servicio'
                                    name='servicio'
                                    size='small'
                                    rows={2}
                                    multiline
                                    fullWidth
                                    required
                                    sx={{ ml: 1, backgroundColor: 'rgba(255,255,255,0.7)' }}
                                    value={formik.values.servicio}
                                    onChange={formik.handleChange}
                                    error={formik.touched.servicio && Boolean(formik.errors.servicio)}
                                    helperText={formik.touched.servicio && formik.errors.servicio}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}





                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl fullWidth>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Prevencionista</FormLabel>  <Select
                                    labelId='lapr'
                                    name='apr'
                                    id='apr'
                                    value={formik.values.apr}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Prevencionista de riesgo'
                                    onChange={formik.handleChange}>
                                    <MenuItem value={'SIN VALOR SELECCIONADO'}>SIN VALOR SELECCIONADO</MenuItem>
                                    {apr.map((opcion) => {
                                        return (<MenuItem value={opcion.sn}>{opcion.sn}</MenuItem>)
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}


                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl fullWidth>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Supervisor</FormLabel>
                                <Select
                                    labelId='lsupervisor'
                                    name='supervisor'
                                    id='supervisor'
                                    value={formik.values.supervisor}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Supervisor' onChange={formik.handleChange}>
                                    <MenuItem value={'SIN VALOR SELECCIONADO'}>SIN VALOR SELECCIONADO</MenuItem>
                                    {supervisor.map((opcion) => {
                                        return (<MenuItem value={opcion.sn}>{opcion.sn}</MenuItem>)
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}


                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl fullWidth>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Administrador</FormLabel>
                                <Select
                                    labelId='ladm'
                                    name='adm'
                                    id='adm'
                                    value={formik.values.adm}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Administrador' onChange={formik.handleChange}>
                                    <MenuItem value={'SIN VALOR SELECCIONADO'}>SIN VALOR SELECCIONADO</MenuItem>
                                    {adm.map((opcion) => {
                                        return (<MenuItem value={opcion.sn}>{opcion.sn}</MenuItem>)
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}

                        {/*---------Inicio de grid item select----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl fullWidth>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Mandante</FormLabel>
                                <Select
                                    labelId='lmandante'
                                    name='mandante'
                                    id='mandante'
                                    value={formik.values.mandante}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Mandante' onChange={formik.handleChange}>
                                    <MenuItem value={'SIN VALOR SELECCIONADO'}>SIN VALOR SELECCIONADO</MenuItem>
                                    {mandantes_r.map((opcion) => {
                                        return (<MenuItem value={opcion.nombre}>{opcion.nombre}</MenuItem>)
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}




                    </Grid>
                    {/*-------------Termino de grid container-----------------*/}


                    <Grid container spacing={0} style={{ margin: 0 }}>
                        {/*-----------------------------------------------------------------------------*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} style={{ padding: 2 }}></Grid>

                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 4 }} sx={{ p: 1, mt: 2 }}>
                            <Button variant='contained' size='small' color="success" fullWidth type="submit">Registrar</Button>
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