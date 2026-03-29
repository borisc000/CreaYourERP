import { Backdrop, Card, CircularProgress, Paper, Typography } from "@mui/material"


export default function Test() {


    return (
        <>

            <Card style={{ minWidth: 275, minHeight: 150, p: 1, m: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}>

                <Typography variant='subtitle1' sx={{ textAlign: 'center', mt: 1 }} color='text.secondary' gutterBottom>
                    <b>Test Module</b>
                </Typography>

            </Card>


        </>
    )


}



