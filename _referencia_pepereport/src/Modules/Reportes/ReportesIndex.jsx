

import {
    DataGrid,
    Toolbar,

    QuickFilter,
    QuickFilterControl,

} from '@mui/x-data-grid';
import { Button, Card, Grid, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { Fragment, useEffect, useState } from 'react';
import { PageviewOutlined } from '@mui/icons-material';


import { esES } from '@mui/x-data-grid/locales';
import { useDispatch } from 'react-redux';

import { useLocation, useNavigate, useParams } from 'react-router';
import { open_back } from '../../Redux/ComDuks';
import { CargarReportes } from '../../Services/Reportes';
import { format } from 'date-fns';


export default function ReportesIndex() {


    let dispatch = useDispatch()
    let navigate = useNavigate()
    let params = useParams()
    let location = useLocation()

    const [rows, setRows] = useState([])


    let mar = '2px 5px 5px 2px'//top, r,b,l  

    useEffect(() => {

        dispatch(open_back(true, 'Cargando reportes'))

        CargarReportes().then((r) => {
            setRows(r)
            dispatch(open_back(false, 'Cargando reportes'))
        })


    }, [])

    const cargar_reporte = (data) => {

        navigate('/reportes/editar', { state: { id: data } })

    }





    //-----------------------------------------------------------------------------------------------

    //-----------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------
    const columns = [
        {
            field: 'Ver', width: 20, renderCell: (params) => (

                <Fragment>

                    <Tooltip title='Abrir reporte'>
                        <IconButton onClick={(event) => {
                            navigate('/reportes/editar', { state: { id: params.row.id } })
                        }}
                            color='secondary'
                            aria-label='add an alarm'
                        >
                            <PageviewOutlined />
                        </IconButton>
                    </Tooltip>

                </Fragment>
            ),
        },

        {
            field: 'estado', headerName: 'Estado', flex: 1, rowSpan: 2, minHeight: 250, renderCell: (params) => (



                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.estado}
                </Typography>
            ),
        },
        {
            field: 'emision', headerName: 'Emision', flex: 1, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (
                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {format(params.row.emision, 'dd-MM-yyyy HH:mm:ss')}
                </Typography>
            ),
        },

        {
            field: 'servicio', headerName: 'Detalles de servicio', flex: 2, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (



                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.servicio}
                </Typography>
            ),
        },

        {
            field: 'tiposervicio', headerName: 'Tipo de servicio', flex: 2, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (



                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.tiposervicio}
                </Typography>
            ),
        },
        {
            field: 'empresa', headerName: 'Empresa', flex: 2, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (



                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.empresa}
                </Typography>
            ),
        },
        {
            field: 'mandante', headerName: 'Mandante', flex: 2, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (



                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.mandante}
                </Typography>
            ),
        },






    ];





    //---------------------------------------------------
    function CustomToolbar() {

        return (





            <Toolbar >
                <Typography fontWeight="medium" sx={{ flex: 1, mx: 0.5 }}>
                    <b>REPORTES REGISTRADOS</b>
                </Typography>

                <Grid container spacing={1}>

                    <Grid size={{ xs: 12, md: 12, lg: 12 }} >
                        <QuickFilter  >
                            <QuickFilterControl render={
                                <TextField size='small' sx={{ width: 250 }} placeholder='Buscar...'></TextField>
                            }>

                            </QuickFilterControl>
                        </QuickFilter>
                    </Grid>



                </Grid >






            </Toolbar >
        );
    }
    //---------------------------------------------------


    return (

        <Fragment>


            <Card sx={{ minWidth: 275, minHeight: 150, p: 1, mb: 1, backgroundColor: 'rgba(255,255,255,0.7)' }}>
                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>Menu de reportes</b>
                </Typography>
                {/*-------------Inicio de grid container------------------*/}
                <Grid container spacing={1}>
                    {/*-------------Inicio de grid item------------------*/}
                    <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar }}>
                        <Button size='small' fullWidth variant="contained" onClick={() => {
                            navigate('/reportes/registrar')

                        }}>Nuevo reporte</Button>
                    </Grid>
                    {/*-------------Termino de grid item------------------*/}

                    {/*-------------Inicio de grid item------------------*/}
                    <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar }}>

                    </Grid>
                    {/*-------------Termino de grid item------------------*/}

                    {/*-------------Inicio de grid item------------------*/}
                    <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar }}>

                    </Grid>
                    {/*-------------Termino de grid item------------------*/}
                </Grid>
                {/*-------------Termino de grid container------------------*/}
            </Card>


            <Card sx={{ minWidth: 50, minHeight: 50, p: 0, m: 0, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.6)' }}>



                <DataGrid localeText={esES.components.MuiDataGrid.defaultProps.localeText}


                    rows={rows}
                    columns={columns}
                    sx={{ overflowX: 'true', overflowY: 'true', p: 0, m: 0, minHeight: 600 }}
                    getRowHeight={() => 'auto'}


                    // disableColumnFilter
                    // disableColumnSelector
                    //disableDensitySelector



                    slots={{ toolbar: CustomToolbar }}

                    showToolbar


                />

            </Card>


        </Fragment>
    );
}


