

import {
    DataGrid,
    Toolbar,

    QuickFilter,
    QuickFilterControl,

} from '@mui/x-data-grid';
import { Card, Grid, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { Fragment, useState } from 'react';
import { PageviewOutlined } from '@mui/icons-material';


import { esES } from '@mui/x-data-grid/locales';
import { useDispatch } from 'react-redux';

import { useLocation, useNavigate, useParams } from 'react-router';


export default function Base_listar() {


    let dispatch = useDispatch()
    let navigate = useNavigate()
    let params = useParams()
    let location = useLocation()

    const [rows, setRows] = useState([{ id: 'miid' }, { id: 'dos' }])





    //-----------------------------------------------------------------------------------------------

    //-----------------------------------------------------------------------------------------------
    //-----------------------------------------------------------------------------------------------
    const columns = [
        {
            field: 'Ver', width: 20, renderCell: (params) => (

                <Fragment>

                    <Tooltip title='Abrir reporte'>
                        <IconButton onClick={(event) => {
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
            field: 'id', headerName: 'Detalles', flex: 2, rowSpan: 2, minHeight: 250, minWidth: 200, renderCell: (params) => (



                <Typography display="block" gutterBottom sx={{ p: 1, whiteSpace: 'break-spaces', fontSize: 12, h: 50 }}>
                    {params.row.id}
                </Typography>
            ),
        },






    ];





    //---------------------------------------------------
    function CustomToolbar() {

        return (
            <Toolbar >
                <Typography fontWeight="medium" sx={{ flex: 1, mx: 0.5 }}>
                    <b>Toolbar</b>
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


