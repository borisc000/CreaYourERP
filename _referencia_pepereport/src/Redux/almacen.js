import { configureStore } from '@reduxjs/toolkit'
import counterReducer from './counterSlice'
import CReducer from './ComDuks'

export default configureStore({
    reducer: {
        commons: CReducer

    },
})