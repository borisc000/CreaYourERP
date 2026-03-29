

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircle from '@mui/icons-material/AccountCircle';
import MailIcon from '@mui/icons-material/Mail';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MoreIcon from '@mui/icons-material/MoreVert';
import Footer from '../Modules/Footer';



import { Routes, Route } from "react-router";
import { cargar_comunes, Logout } from '../Services/Firebase';

import { Alert, Backdrop, CircularProgress, Drawer, Snackbar } from '@mui/material';
import MainMenu from './Menus/MainMenu';
import { LogoutRounded } from '@mui/icons-material';

import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { areas_redux, cargos_redux, empresas_redux, mandantes_redux, open_back, open_snackbar, personal_redux, sectores_redux, tiposervicios_redux } from '../Redux/ComDuks';
import { useEffect, useState } from 'react';
import { LoadAreas, LoadCargos, LoadEmpresas, LoadMandantes, LoadPersonal, LoadSectores, LoadTiposervicios } from '../Services/CommonService';
import ReportesIndex from './Reportes/ReportesIndex';
import ReportesAdd from './Reportes/ReportesAdd';
import ReportesEdit from './Reportes/ReportesEdit';
import CheckPointAdd from './CheckPoints/CheckPointAdd';
import CheckPointEdit from './CheckPoints/CheckPointEdit';
import EmpresasList from './Empresas/EmpresasList';
import AreasAdd from './Empresas/AreasAdd';
import SectorAdd from './Empresas/SectorAdd';
import MandantesAdd from './Empresas/MandatesAdd';
import EmpresasAdd from './Empresas/EmpresasAdd';
import MiEmpresa from './Empresas/Miempresa';
import Miscelaneos from './Empresas/Miscelaneos';
import PersonalList from './Personal/PersonalList';
import PersonalRegistrar from './Personal/PersonalRegistrar';
import PersonalRun from './Personal/PersonalRun';
import PersonalEditar from './Personal/PersonalEditar';





export default function Navbar() {


    let dispatch = useDispatch()

    const [Mensajes, setMensajes] = useState(0)
    const [Notificaciones, setNotificaciones] = useState(0)

    const [menudrawer, setMenudrawer] = useState(false)
    const [anchorEl, setAnchorEl] = useState(null);
    const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = useState(null);

    let backdrop = useSelector(almacen => almacen.commons.open_back)
    let snack = useSelector(almacen => almacen.commons.open_snackbar)


    const isMenuOpen = Boolean(anchorEl);
    const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);

    const handleProfileMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMobileMenuClose = () => {
        setMobileMoreAnchorEl(null);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        handleMobileMenuClose();
    };

    const handleMobileMenuOpen = (event) => {
        setMobileMoreAnchorEl(event.currentTarget);
    };




    useEffect(() => {

        dispatch(open_back(true, 'Cargando empresas'))

        LoadEmpresas().then((r) => {



            dispatch(empresas_redux(r))
            dispatch(open_back(true, 'Cargando cargos'))
            LoadCargos().then((r) => {
                dispatch(cargos_redux(r))
                dispatch(open_back(true, 'Cargando areas'))
                LoadAreas().then((r) => {
                    dispatch(areas_redux(r))
                    dispatch(open_back(true, 'Cargando sectores'))
                    LoadSectores().then((r) => {
                        dispatch(sectores_redux(r))
                        dispatch(open_back(true, 'Cargando personal'))

                        LoadPersonal().then((r) => {

                            dispatch(personal_redux(r))

                            dispatch(open_back(true, 'Cargando servicios'))
                            LoadTiposervicios().then((r) => {
                                dispatch(tiposervicios_redux(r))


                                dispatch(open_back(true, 'Cargando Mandantes'))
                                LoadMandantes().then((r) => {

                                    dispatch(mandantes_redux(r))

                                    cargar_comunes().then(() => {

                                        dispatch(open_back(false, 'Finalizado'))
                                    })



                                })



                            })



                        })


                    })
                })
            })

        })
    }, [])


    const menuId = 'primary-search-account-menu';
    const renderMenu = (
        <Menu
            anchorEl={anchorEl}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            id={menuId}
            keepMounted
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            open={isMenuOpen}
            onClose={handleMenuClose}
        >

            <MenuItem onClick={() => { Logout() }}>Salir</MenuItem>
        </Menu>
    );

    const mobileMenuId = 'primary-search-account-menu-mobile';
    const renderMobileMenu = (
        <Menu
            anchorEl={mobileMoreAnchorEl}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            id={mobileMenuId}
            keepMounted
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            open={isMobileMenuOpen}
            onClose={handleMobileMenuClose}
        >
            <MenuItem sx={{ display: 'none' }} >
                <IconButton sx={{ display: 'none' }} size="large" aria-label="show 4 new mails" color="inherit">
                    <Badge sx={{ display: 'none' }} badgeContent={Mensajes} color="error">
                        <MailIcon />
                    </Badge>
                </IconButton>
                <p>Mensajes</p>
            </MenuItem>
            <MenuItem sx={{ display: 'none' }} >
                <IconButton
                    size="large"
                    aria-label="show 17 new notifications"
                    color="inherit"
                    sx={{ display: 'none' }}
                >
                    <Badge sx={{ display: 'none' }} badgeContent={Mensajes} color="error">
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
                <p>Notificaciones</p>
            </MenuItem>

            <MenuItem onClick={() => { Logout() }}>
                <IconButton
                    size="large"
                    aria-label="show 17 new notifications"
                    color="inherit"
                >
                    <Badge badgeContent={Notificaciones} color="error">
                        <LogoutRounded />
                    </Badge>
                </IconButton>
                <p>Salir</p>
            </MenuItem>


            <MenuItem onClick={handleProfileMenuOpen} sx={{ display: 'none' }}>
                <IconButton
                    size="large"
                    aria-label="account of current user"
                    aria-controls="primary-search-account-menu"
                    aria-haspopup="true"
                    color="inherit"
                >
                    <AccountCircle />
                </IconButton>
                <p>Profile</p>
            </MenuItem>
        </Menu>
    );

    return (
        <Box sx={{ flexGrow: 1, fontSize: 'small' }}>
            <AppBar position="static" size='small' >
                <Toolbar>
                    <IconButton
                        size="large"
                        edge="start"
                        color="inherit"
                        aria-label="open drawer"
                        sx={{ mr: 2 }}
                        onClick={() => {
                            setMenudrawer(true)
                        }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                        sx={{ display: { xs: 'block', sm: 'block' } }}
                    >
                        Reportes
                    </Typography>

                    <Box sx={{ flexGrow: 1 }} />
                    <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
                        <IconButton sx={{ display: 'none' }} size="large" aria-label="show 4 new mails" color="inherit">
                            <Badge badgeContent={Mensajes} color="error">
                                <MailIcon />
                            </Badge>
                        </IconButton>
                        <IconButton
                            size="large"
                            aria-label=""
                            color="inherit"
                            sx={{ display: 'none' }}
                        >
                            <Badge badgeContent={Notificaciones} color="error">
                                <NotificationsIcon />
                            </Badge>
                        </IconButton>
                        <IconButton
                            size="large"
                            edge="end"
                            aria-label=""
                            aria-controls={menuId}
                            aria-haspopup="true"
                            onClick={handleProfileMenuOpen}
                            color="inherit"
                        >
                            <AccountCircle />
                        </IconButton>
                    </Box>
                    <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
                        <IconButton
                            size="large"
                            aria-label="show more"
                            aria-controls={mobileMenuId}
                            aria-haspopup="true"
                            onClick={handleMobileMenuOpen}
                            color="inherit"
                        >
                            <MoreIcon />
                        </IconButton>
                    </Box>
                </Toolbar>
            </AppBar>
            {renderMobileMenu}
            {renderMenu}



            <Backdrop
                sx={(theme) => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                open={backdrop.t}

            >
                <Typography variant="subtitle1" gutterBottom sx={{ margin: 2 }}>
                    {backdrop.m}
                </Typography>
                <CircularProgress color="inherit" />
            </Backdrop>



            <Snackbar open={snack.t} autoHideDuration={2500} onClose={() => { dispatch(open_snackbar(false, '', '')) }} >
                <Alert

                    severity={snack.c}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snack.m}
                </Alert>
            </Snackbar>



            <Drawer
                anchor='left'
                open={menudrawer}
                onClose={() => { setMenudrawer(false) }}
                onClick={() => { setMenudrawer(false) }}
            >

                <MainMenu />

            </Drawer>







            <Box sx={{ minHeight: 'calc(100vh - 160px)', mt: 2 }}>



                <Routes>


                    <Route path="/" element={<ReportesIndex />} />


                    {/*Gestion de personal*/}

                    <Route path="/personal/index" element={<PersonalList />} />


                    <Route path="/personal/registrar" element={<PersonalRegistrar />} />
                    <Route path="/personal/verificar" element={<PersonalRun />} />

                    <Route path="/personal/editar" element={<PersonalEditar />} />
                    {/*Gestion de reportes*/}

                    <Route path="/reportes" element={<ReportesIndex />} />
                    <Route path="/reportes/registrar" element={<ReportesAdd />} />
                    <Route path="/reportes/editar" element={<ReportesEdit />} />

                    {/*Gestion de puntos de control*/}
                    <Route path="/checkpoint/registrar" element={<CheckPointAdd />} />





                    <Route path="/checkpoint/editar" element={<CheckPointEdit />} />


                    {/*Gestion de puntos de control*/}
                    <Route path="/empresas" element={<EmpresasList />} />
                    <Route path="/empresas/mandantes" element={<MandantesAdd />} />
                    <Route path="/empresas/areas" element={<AreasAdd />} />
                    <Route path="/empresas/sector" element={<SectorAdd />} />
                    <Route path="/empresas/registrar" element={<EmpresasAdd />} />
                    <Route path="/empresas/miempresa" element={<MiEmpresa />} />

                    <Route path="/empresas/misc" element={<Miscelaneos />} />

                    {/*bases*/}



                </Routes>
            </Box>
            <Footer />
        </Box>
    );
}
