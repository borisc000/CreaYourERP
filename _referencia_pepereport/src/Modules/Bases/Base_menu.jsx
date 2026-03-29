import { Button, Card, Grid, Typography } from '@mui/material'
import { useNavigate } from 'react-router';

export default function Base_Menu() {

    let mar = '5px 5px 5px 5px'//top, r,b,l  

    let navigate = useNavigate()




    return (
        <>

            <Card style={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>
                <Typography variant='h5' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    Cabecera de card
                </Typography>
                {/*-------------Inicio de grid container------------------*/}
                <Grid container spacing={1}>
                    {/*-------------Inicio de grid item------------------*/}
                    <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar }}>

                        <Button fullWidth variant="contained" sx={{ m: mar }} onClick={() => {
                            navigate('/personal/registrar', { state: { data: 'someData' } });
                        }}>Registrar nuevo</Button>

                    </Grid>
                    {/*-------------Termino de grid item------------------*/}

                    {/*-------------Inicio de grid item------------------*/}
                    <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar }}>

                        <Button fullWidth variant="contained" sx={{ m: mar }}>Registrar nuevo</Button>
                    </Grid>
                    {/*-------------Termino de grid item------------------*/}

                    {/*-------------Inicio de grid item------------------*/}
                    <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ p: mar }}>

                        <Button fullWidth variant="contained" sx={{ m: mar }}>Registrar nuevo</Button>
                    </Grid>
                    {/*-------------Termino de grid item------------------*/}
                </Grid>
                {/*-------------Termino de grid container------------------*/}
            </Card>


        </>
    )
}
