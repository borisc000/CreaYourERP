import { Backdrop, Button, Card, CircularProgress, Divider, Paper, Typography } from "@mui/material"
import { verificarPermisos } from "../Services/firebase"


export default function Testing() {


    return (
        <>

            <Card style={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>Tersting module</b>
                </Typography>

                <br />
                <Button variant="contained" sx={{ m: 0.5 }} onClick={() => { verificarPermisos('001') }}>Test menu 001</Button>
                <br />
                <Button variant="contained" sx={{ m: 0.5 }} onClick={() => { verificarPermisos('002') }}>Test menu 002</Button>
                <br />
                <Button variant="contained" sx={{ m: 0.5 }} onClick={() => { verificarPermisos('003') }}>Test menu 003</Button>
            </Card>


        </>
    )


}



