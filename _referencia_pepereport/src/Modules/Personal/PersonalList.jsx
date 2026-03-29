

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
import { CargarEmpresas } from '../../Services/Empresas';

import AddHomeWorkIcon from '@mui/icons-material/AddHomeWork';
import { CargarPersonal } from '../../Services/Personal';




export default function PersonalList() {


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


        dispatch(open_back(true, 'Cargando personal'))



        CargarPersonal().then((r) => {
            setRows(r)

            dispatch(open_back(false, 'Realizado'))
        })


    }, [])



    //-----------------------------------------------------------------------------------------------

    //-----------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------
    const columns = [

        {




            field: 'Ver', minWidth: 50, renderCell: (params) => (

                <Fragment>



                    <Tooltip title='Ver/Actualizar'>
                        <IconButton onClick={(event) => {

                            navigate('/personal/editar', { state: { run: params.row.run } })

                            //(params.row.id)
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
            field: 'run', headerName: 'Run', flex: 0.5, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (
                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.run}
                </Typography>
            ),
        },

        {
            field: 'cnombre', headerName: 'Nombre', flex: 2, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (
                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.cnombre}
                </Typography>
            ),
        },

        {
            field: 'cargo', headerName: 'Cargo', flex: 1, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (
                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.cargo}
                </Typography>
            ),
        },







    ];





    //---------------------------------------------------
    function CustomToolbar() {

        return (
            <Toolbar >
                <Typography fontWeight="medium" sx={{ flex: 1, mx: 0.5 }}>
                    <b></b>PERSONAL REGISTRADO
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
                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1, mb: 1 }} color='text.secondary' gutterBottom>
                    <b>MENU DE PERSONAL</b>
                </Typography>
                {/*-------------Inicio de grid container------------------*/}
                <Grid container spacing={1}>
                    {/*-------------Inicio de grid item------------------*/}
                    <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar }}>
                        <Button variant="contained" sx={{ width: '90%' }} onClick={() => {
                            navigate('/personal/verificar')
                        }}>Registrar personal</Button>
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


