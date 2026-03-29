
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import { useNavigate } from 'react-router';
import { useEffect, useState } from 'react';




export default function MainMenu() {

    let navigate = useNavigate()

    const [m001, setm001] = useState(JSON.parse(localStorage.getItem("m001")))
    const [m002, setm002] = useState(JSON.parse(localStorage.getItem("m002")))
    const [m003, setm003] = useState(JSON.parse(localStorage.getItem("m003")))





    const rutas = (r) => {
        navigate(r)
    }




    return (
        <Paper sx={{ width: 320 }}>
            <MenuList dense>
                <MenuItem>
                    <ListItemText inset onClick={() => { rutas('/') }}><b>Home</b></ListItemText>
                </MenuItem>
                <Divider />


                <MenuItem>
                    <ListItemText ><b>Reportes</b></ListItemText>
                </MenuItem>


                <MenuItem onClick={() => { rutas('/reportes') }}>
                    <ListItemText inset>Reportes</ListItemText>
                </MenuItem>


                <MenuItem>
                    <ListItemText ><b>Empresas</b></ListItemText>
                </MenuItem>


                <MenuItem onClick={() => { rutas('/empresas') }}>
                    <ListItemText inset>Empresas</ListItemText>
                </MenuItem>

                <MenuItem onClick={() => { rutas('/empresas/miempresa') }}>
                    <ListItemText inset>Datos globales</ListItemText>
                </MenuItem>


                <MenuItem onClick={() => { rutas('/empresas/misc') }}>
                    <ListItemText inset>Registrar otros datos</ListItemText>
                </MenuItem>


                <Divider />


                <MenuItem>
                    <ListItemText ><b>Gestion de Personal</b></ListItemText>
                </MenuItem>


                <MenuItem onClick={() => { rutas('/personal/index') }}>
                    <ListItemText inset>Personal</ListItemText>
                </MenuItem>




                <Divider />














            </MenuList>
        </Paper>
    );
}
