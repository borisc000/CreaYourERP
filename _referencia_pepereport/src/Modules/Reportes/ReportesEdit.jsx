import { Autocomplete, Button, Card, FormControl, FormLabel, Grid, MenuItem, Select, TextField, Typography } from '@mui/material'
import { useFormik } from 'formik'

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router';

import * as yup from 'yup';
import { useEffect, useState } from 'react';

import { format } from 'date-fns';

import Swal from 'sweetalert2';
import { open_back } from '../../Redux/ComDuks';


import { LocalizationProvider, MobileDateTimePicker, PickersTextField } from '@mui/x-date-pickers';
// If you are using date-fns v3.x or v4.x, please import `AdapterDateFns`
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ActualizarReporte, CargarReporte, CerrarReporte } from '../../Services/Reportes';
import ReportePrint from './ReportePrint';
import CheckPointList from '../CheckPoints/CheckPointList';

import { es } from 'date-fns/locale';





//import { verificarPermisos } from '../../Services/Firebase';

const validationSchema = yup.object({
    //.matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/,'Debe ser en formato xx.xxx.xxx-x')
    // run: yup.string().required('Este campo es requerido').matches(/^(d{1,2}(?:.d{1,3}){2}-[dkK])$/, 'Debe ser en formato xx.xxx.xxx-x')
    // dato: yup.string().required('Este campo es requerido')
});


export default function ReportesEdit() {


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

    let tiposervicios_r = useSelector(almacen => almacen.commons.tiposervicios_redux)

    const [areas, setAreas] = useState([])
    const [sectores, setSectores] = useState([])
    const [apr, setApr] = useState([])
    const [supervisor, setsupervisor] = useState([])
    const [adm, setAdm] = useState([])
    const [mandante, setMandante] = useState([])
    const [id, setid] = useState('')
    const [ed, setEd] = useState(false)
    const [act, setact] = useState('')



    useEffect(() => {
        setApr(personal_r.filter(personal => personal.cargo == 'APR'))
        setsupervisor(personal_r.filter(personal => personal.cargo == 'SUPERVISOR'))
        setAdm(personal_r.filter(personal => personal.cargo == 'ADC'))
        setMandante(personal_r.filter(personal => personal.cargo == 'MANDANTE'))
    }, [personal_r])


    const areasfilter = (data) => {
        setAreas(areas_r.filter(opcion => opcion.empresa == data))
    }
    const sectoresfilter = (data) => {
        setSectores(sectores_r.filter(opcion => opcion.area == data))
    }

    useEffect(() => {

        dispath(open_back(true, 'Cargando reporte'))

        CargarReporte(location.state.id).then((r) => {
            formik.setFieldValue('id', r.id)
            formik.setFieldValue('emision', parseInt(r.emision))
            formik.setFieldValue('estado', r.estado)
            formik.setFieldValue('empresa', r.empresa)
            formik.setFieldValue('servicio', r.servicio)
            formik.setFieldValue('apr', r.apr)
            formik.setFieldValue('supervisor', r.supervisor)
            formik.setFieldValue('adm', r.adm)
            formik.setFieldValue('mandante', r.mandante)
            formik.setFieldValue('tiposervicio', r.tiposervicio)
            formik.setFieldValue('area', r.area)
            formik.setFieldValue('sector', r.sector)
            localStorage.setItem('reporte', JSON.stringify(r))
            setid(r.id)
            if (r.estado == "CERRADO") {
                setEd(true)
            }

            dispath(open_back(false, 'Cargando reporte'))
        })

    }, [act])





    //---------------------Funciones de usuario-----------------------
    const formik = useFormik({
        initialValues: {
            //---------------------valores de formik----------------------
            id: 'SIN VALOR SELECCIONADO',
            shdate: '',
            apr: 'SIN VALOR SELECCIONADO',
            supervisor: 'SIN VALOR SELECCIONADO',
            adm: 'SIN VALOR SELECCIONADO',
            mandante: 'SIN VALOR SELECCIONADO',
            empresa: 'SIN VALOR SELECCIONADO',
            area: 'SIN VALOR SELECCIONADO',
            sector: 'SIN VALOR SELECCIONADO',
            tiposervicio: 'SIN VALOR SELECCIONADO',
            servicio: '',
            estado: 'SIN FINALIZAR',
            emision: Date.now()


            //---------------------fin valores de formik------------------
        },
        validationSchema: validationSchema,
        onSubmit: (values) => {

            dispath(open_back(true, 'Guardando reporte'))

            ActualizarReporte(values).then((r) => {
                dispath(open_back(true, 'Actualizando reporte'))
                setact(Date.now())

                dispath(open_back(false, 'Guardando reporte'))

            })





        },
    });











    return (
        <>
            <Card style={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    EDICION DE REPORTE DE SERVICIO
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
                                        fullWidth slotProps={{ textField: { size: 'small' } }}

                                        onChange={(e) => {

                                            formik.setFieldValue("emision", e)



                                        }}

                                        value={formik.values.emision}
                                        defaultValue={Date.now()}
                                    />
                                </LocalizationProvider>


                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}







                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 2 }} sx={{ p: mar, textAlign: 'left' }}>
                            <FormControl component='fieldset' style={{ minWidth: '100%' }}>
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Estado de reporte</FormLabel>
                                <TextField
                                    id='estado'
                                    name='estado'
                                    size='small'
                                    rows={1}
                                    multiline
                                    disabled
                                    fullWidth
                                    required
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    value={formik.values.estado}
                                    onChange={formik.handleChange}
                                    error={formik.touched.estado && Boolean(formik.errors.estado)}
                                    helperText={formik.touched.estado && formik.errors.estado}
                                />
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item----------*/}



                        {/*---------Inicio de grid item----------*/}
                        <Grid size={{ xs: 12, md: 6, lg: 3 }} sx={{ p: mar, textAlign: 'left' }}>
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
                                        formik.setFieldValue('sector', 'SIN VALOR SELECCIONADO')
                                        //setSectores([{ sector: 'SIN VALOR SELECCIONADO' }])

                                        sectoresfilter(e.target.value)

                                    }
                                    }
                                    onClick={() => {



                                    }}>
                                    <MenuItem value={formik.values.area}>{formik.values.area}</MenuItem>
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
                                    <MenuItem value={formik.values.sector}>{formik.values.sector}</MenuItem>
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
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Prevencionista</FormLabel>
                                <Select
                                    labelId='lapr'
                                    name='apr'
                                    id='apr'
                                    value={formik.values.apr}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Prevencionista' onChange={formik.handleChange}>
                                    <MenuItem value={formik.values.apr}>{formik.values.apr}</MenuItem>
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
                                    <MenuItem value={formik.values.supervisor}>{formik.values.supervisor}</MenuItem>
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
                                <FormLabel sx={{ ml: 1, pb: 0.5, }}>Administrador de contrato</FormLabel>
                                <Select
                                    labelId='ladm'
                                    name='adm'
                                    id='adm'
                                    value={formik.values.adm}
                                    sx={{ ml: 0.5, mr: 0.5, backgroundColor: 'rgba(255,255,255,0.7)', textAlign: 'left' }}
                                    size='small'
                                    label='Administrador de contrato' onChange={formik.handleChange}>
                                    <MenuItem value={formik.values.adm}>{formik.values.adm}</MenuItem>
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
                                    <MenuItem value={formik.values.mandante}>{formik.values.mandante}</MenuItem>
                                    {mandante.map((opcion) => {
                                        return (<MenuItem value={opcion.sn}>{opcion.sn}</MenuItem>)
                                    })}
                                </Select>
                            </FormControl>
                        </Grid>
                        {/*---------Termino de grid item select----------*/}





                    </Grid>
                    {/*-------------Termino de grid container-----------------*/}


                    <Grid container spacing={0} style={{ margin: 0 }}>
                        {/*-----------------------------------------------------------------------------*/}
                        <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ padding: 1, mt: 1 }}>

                            <ReportePrint />

                        </Grid>

                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ p: 1, mt: 1 }}>
                            <Button variant='contained' disabled={ed} size='small' color="success" fullWidth onClick={() => {
                                navigate('/checkpoint/registrar', { state: { id: location.state.id } })
                            }}>Insertar punto de control</Button>
                        </Grid>
                        {/*-------------Termino de grid item*/}

                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ p: 1, mt: 1 }}>
                            <Button variant='contained' disabled={ed} size='small' color="info" type="submit" fullWidth>Actualizar datos</Button>
                        </Grid>
                        {/*-------------Termino de grid item*/}

                        {/*--------------Inicio de grid item*/}
                        <Grid size={{ xs: 12, md: 4, lg: 3 }} sx={{ p: 1, mt: 1 }}>
                            <Button variant='contained' disabled={ed} size='small' color="warning" fullWidth onClick={() => {
                                Swal.fire({
                                    title: "¿Esta seguro?",
                                    text: "Se procedera a cerrar este reporte, una vez realizado ya no se podran realizar cambios ¿desea continuar?",
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonColor: "#3085d6",
                                    cancelButtonColor: "#d33",
                                    confirmButtonText: "Si, proceder"
                                }).then((result) => {
                                    if (result.isConfirmed) {
                                        dispath(open_back(true, 'Cargando reporte'))
                                        CerrarReporte(id).then(() => {

                                            Swal.fire({
                                                title: "¡Reporte actualizado!",
                                                text: "Este reporte fue correctamente cerrado",
                                                icon: "success"
                                            });
                                            dispath(open_back(false, 'Cargando reporte'))
                                            navigate('/reportes')

                                        })









                                    }
                                });

                            }}>Cerrar reporte</Button>
                        </Grid>
                        {/*-------------Termino de grid item*/}


                    </Grid>
                    {/*-----------------------------------------------------------------------------*/}

                </form>

            </Card >
            <br />

            <CheckPointList />


        </>
    )
}