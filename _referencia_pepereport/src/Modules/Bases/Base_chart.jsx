import { Card, Grid, Typography } from '@mui/material';
import ReactECharts from 'echarts-for-react';

export default function Base_chart() {

    let option = {
        tooltip: {
            trigger: 'item'
        },
        legend: {
            top: '5%',
            left: 'center'
        },
        series: [
            {
                name: 'Access From',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 40,
                        fontWeight: 'bold'
                    }
                },
                labelLine: {
                    show: false
                },
                data: [
                    { value: 1048, name: 'Search Engine' },
                    { value: 735, name: 'Direct' },
                    { value: 580, name: 'Email' },
                    { value: 484, name: 'Union Ads' },
                    { value: 300, name: 'Video Ads' }
                ]
            }
        ]
    };






    return (
        <>




            {/*-------------Inicio de grid container------------------*/}
            <Grid container spacing={1}>

                {/*-------------Inicio de grid item------------------*/}
                <Grid size={{ xs: 12, md: 6, lg: 4 }} style={{ padding: 1 }}>
                    <ReactECharts
                        option={option}
                        style={{ height: '300px', width: '100%' }}
                        notMerge={true}
                        lazyUpdate={true}
                        theme={"theme_name"}
                    />
                </Grid>
                {/*-------------Termino de grid item------------------*/}

                {/*-------------Inicio de grid item------------------*/}
                <Grid size={{ xs: 12, md: 6, lg: 4 }} style={{ padding: 1 }}>
                    <ReactECharts
                        option={option}
                        style={{ height: '300px', width: '100%' }}
                        notMerge={true}
                        lazyUpdate={true}
                        theme={"theme_name"}
                    />
                </Grid>
                {/*-------------Termino de grid item------------------*/}

                {/*-------------Inicio de grid item------------------*/}
                <Grid size={{ xs: 12, md: 6, lg: 4 }} style={{ padding: 1 }}>
                    <ReactECharts
                        option={option}
                        style={{ height: '300px', width: '100%' }}
                        notMerge={true}
                        lazyUpdate={true}
                        theme={"theme_name"}
                    />
                </Grid>
                {/*-------------Termino de grid item------------------*/}


            </Grid>
            {/*-------------Termino de grid container------------------*/}









        </>
    )
}
