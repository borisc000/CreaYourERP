

import {
    DataGrid,
    Toolbar,

    QuickFilter,
    QuickFilterControl,

} from '@mui/x-data-grid';
import { Button, Card, Dialog, DialogContent, DialogContentText, DialogTitle, Grid, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { Fragment, useEffect, useState } from 'react';
import { AccountBox, AddHome, PageviewOutlined } from '@mui/icons-material';



import { esES } from '@mui/x-data-grid/locales';
import { useDispatch } from 'react-redux';

import { useLocation, useNavigate, useParams } from 'react-router';

import { open_back } from '../../Redux/ComDuks';
import { cargarcheckpoints } from '../../Services/Checkpoints';
import { format } from 'date-fns';
import { CargarEmpresas } from '../../Services/Empresas';

import AddHomeWorkIcon from '@mui/icons-material/AddHomeWork';
import SectorAdd from './SectorAdd';
import AreasAdd from './AreasAdd';



export default function EmpresasList() {


    let dispatch = useDispatch()
    let navigate = useNavigate()
    let params = useParams()
    let location = useLocation()

    const [openarea, setOpenarea] = useState(false)
    const [id, setid] = useState('')
    const [empresa, setEmpresa] = useState('')

    const [rows, setRows] = useState([])

    let mar = '0px 5px 0px 2px'//top, r,b,l  

    useEffect(() => {


        dispatch(open_back(true, 'Cargando empresas registradas'))



        CargarEmpresas().then((r) => {
            setRows(r)

            dispatch(open_back(false, 'Realizado'))
        })


    }, [])

    const cargar_reporte = (data) => {
        navigate('/checkpoint/editar', { state: { id: data } })

    }





    //-----------------------------------------------------------------------------------------------

    //-----------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------
    const columns = [
        {




            field: 'Ver', minWidth: 200, renderCell: (params) => (

                <Fragment>



                    <Tooltip title='Modificar empresa'>
                        <IconButton onClick={(event) => {


                            //(params.row.id)
                        }}
                            color='secondary'
                            aria-label='add an alarm'
                        >
                            <PageviewOutlined />
                        </IconButton>
                    </Tooltip>


                    <Tooltip title='Agregar area'>
                        <IconButton onClick={(event) => {

                            navigate('/empresas/areas', { state: { id: params.row.empresa } })
                        }}
                            color='secondary'
                            aria-label='add an alarm'
                        >
                            <AddHome />
                        </IconButton>
                    </Tooltip>


                    <Tooltip title='Agregar sectores'>
                        <IconButton onClick={(event) => {
                            navigate('/empresas/sector', { state: { id: params.row.empresa } })
                        }}
                            color='secondary'
                            aria-label='add an alarm'
                        >
                            <AddHomeWorkIcon />
                        </IconButton>
                    </Tooltip>




                    <Tooltip title='Agregar mandante'>
                        <IconButton onClick={(event) => {

                            navigate('/empresas/mandantes', { state: { id: params.row.empresa } })



                        }}
                            color='secondary'
                            aria-label='add an alarm'
                        >
                            <AccountBox />
                        </IconButton>
                    </Tooltip>

                </Fragment>
            ),
        },

        {
            field: 'empresa', headerName: 'Empresa', flex: 1, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (
                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.empresa}
                </Typography>
            ),
        },

        {
            field: 'descripcion', headerName: 'Descripcion de empresa', flex: 2, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (
                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.descripcion}
                </Typography>
            ),
        },







    ];





    //---------------------------------------------------
    function CustomToolbar() {

        return (
            <Toolbar >
                <Typography fontWeight="medium" sx={{ flex: 1, mx: 0.5 }}>
                    <b>Check-point registrados</b>
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



            <Card sx={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>
                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>Cabecera de card</b>
                </Typography>
                {/*-------------Inicio de grid container------------------*/}
                <Grid container spacing={1}>
                    {/*-------------Inicio de grid item------------------*/}
                    <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar }}>
                        <Button variant="contained" sx={{ width: '90%' }} onClick={() => {
                            navigate('/empresas/registrar')
                        }}>Registrar nueva empresa</Button>
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


