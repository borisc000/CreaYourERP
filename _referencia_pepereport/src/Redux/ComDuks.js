



// Constantes
const dataInicial = {


    pass_data: {},
    open_back: { t: false, m: '' },
    open_snackbar: { t: false, m: '', c: 'success' },
    empresas_redux: [],
    areas_redux: [],


    idt0_redux: '',
    idt1_redux: '',
    idt2_redux: '',


    mandantes_redux: [],
    sectores_redux: [],
    personal_redux: [],
    cargos_redux: [],
    tiposervicios_redux: []

}


const _OPEN_BACK = "OPEN_BACK"
const _OPEN_SNACKBAR = "OPEN_SNACKBAR"
const _PASS_DATA = "PASS_DATA"
const _EMPRESAS_REDUX = "EMPRESAS_REDUX"
const _AREAS_REDUX = "AREAS_REDUX"
const _SECTORES_REDUX = "SECTORES_REDUX"
const _CARGOS_REDUX = "CARGOS_REDUX"
const _PERSONAL_REDUX = "PERSONAL_REDUX"
const _TIPOSERVICIOS_REDUX = "TIPOSERVICIOS_REDUX"
const _MANDANTES_REDUX = "MANDANTES_REDUX"

const _IDT0_REDUX = "IDT0_REDUX"
const _IDT1_REDUX = "IDT1_REDUX"
const _IDT2_REDUX = "IDT2_REDUX"


// Reducer 
export default function CReducer(state = dataInicial, action) {
    switch (action.type) {

        case _OPEN_BACK:
            return { ...state, open_back: action.payload }
        case _OPEN_SNACKBAR:
            return { ...state, open_snackbar: action.payload }
        case _PASS_DATA:
            return { ...state, pass_data: action.payload }
        case _EMPRESAS_REDUX:
            return { ...state, empresas_redux: action.payload }
        case _AREAS_REDUX:
            return { ...state, areas_redux: action.payload }
        case _SECTORES_REDUX:
            return { ...state, sectores_redux: action.payload }
        case _CARGOS_REDUX:
            return { ...state, cargos_redux: action.payload }
        case _PERSONAL_REDUX:
            return { ...state, personal_redux: action.payload }
        case _TIPOSERVICIOS_REDUX:
            return { ...state, tiposervicios_redux: action.payload }

        case _MANDANTES_REDUX:
            return { ...state, mandantes_redux: action.payload }

        case _IDT0_REDUX:
            return { ...state, idt0_redux_redux: action.payload }
        case _IDT1_REDUX:
            return { ...state, idt1_redux_redux: action.payload }
        case _IDT2_REDUX:
            return { ...state, idt2_redux_redux: action.payload }


        default:
            return state
    }
}

// Acciones
//----------------------------------------------------------------------//

//----------------------------------------------------------------------//

//----------------------------------------------------------------------//
export const mandantes_redux = (ob) => async (dispatch, getState) => {


    try {
        //
        dispatch({
            type: _MANDANTES_REDUX,
            payload: ob,
        })
        //

    } catch (error) {
        console.log(error)
    }

}
//----------------------------------------------------------------------//

//----------------------------------------------------------------------//
export const tiposervicios_redux = (ob) => async (dispatch, getState) => {





    try {
        //
        dispatch({
            type: _TIPOSERVICIOS_REDUX,
            payload: ob,
        })
        //

    } catch (error) {
        console.log(error)
    }

}
//----------------------------------------------------------------------//


//----------------------------------------------------------------------//
export const personal_redux = (ob) => async (dispatch, getState) => {


    try {
        //
        dispatch({
            type: _PERSONAL_REDUX,
            payload: ob,
        })
        //

    } catch (error) {
        console.log(error)
    }

}
//----------------------------------------------------------------------//
//----------------------------------------------------------------------//
export const idt0_redux_redux = (ob) => async (dispatch, getState) => {
    try {
        //
        dispatch({
            type: _IDT0_REDUX,
            payload: ob,
        })
        //
    } catch (error) {
        console.log(error)
    }
}
//----------------------------------------------------------------------//
//----------------------------------------------------------------------//
export const idt1_redux_redux = (ob) => async (dispatch, getState) => {
    try {
        //
        dispatch({
            type: _IDT1_REDUX,
            payload: ob,
        })
        //
    } catch (error) {
        console.log(error)
    }
}
//----------------------------------------------------------------------//
//----------------------------------------------------------------------//
export const idt2_redux_redux = (ob) => async (dispatch, getState) => {
    try {
        //
        dispatch({
            type: _IDT2_REDUX,
            payload: ob,
        })
        //
    } catch (error) {
        console.log(error)
    }
}
//----------------------------------------------------------------------//
//----------------------------------------------------------------------//
export const empresas_redux = (ob) => async (dispatch, getState) => {
    try {
        //
        dispatch({
            type: _EMPRESAS_REDUX,
            payload: ob,
        })
        //
    } catch (error) {
        console.log(error)
    }
}
//----------------------------------------------------------------------//
//----------------------------------------------------------------------//
export const sectores_redux = (ob) => async (dispatch, getState) => {


    try {
        //
        dispatch({
            type: _SECTORES_REDUX,
            payload: ob,
        })
        //

    } catch (error) {
        console.log(error)
    }

}
//----------------------------------------------------------------------//
//----------------------------------------------------------------------//
export const areas_redux = (ob) => async (dispatch, getState) => {

    try {
        //
        dispatch({
            type: _AREAS_REDUX,
            payload: ob,
        })
        //

    } catch (error) {
        console.log(error)
    }

}
//----------------------------------------------------------------------//
//----------------------------------------------------------------------//
export const cargos_redux = (ob) => async (dispatch, getState) => {

    try {
        //
        dispatch({
            type: _CARGOS_REDUX,
            payload: ob,
        })
        //

    } catch (error) {
        console.log(error)
    }

}
//----------------------------------------------------------------------//
//----------------------------------------------------------------------//
export const pass_data = (ob) => async (dispatch, getState) => {


    try {
        //
        dispatch({
            type: _PASS_DATA,
            payload: ob,
        })
        //

    } catch (error) {
        console.log(error)
    }

}
//----------------------------------------------------------------------//

//----------------------------------------------------------------------//
export const open_snackbar = (t, m, c) => async (dispatch, getState) => {


    let ob = {}
    ob.t = t
    ob.m = m
    ob.c = c



    try {
        //
        dispatch({
            type: _OPEN_SNACKBAR,
            payload: ob,
        })
        //

    } catch (error) {
        console.log(error)
    }

}
//----------------------------------------------------------------------//



//----------------------------------------------------------------------//
export const open_back = (t, m) => async (dispatch, getState) => {

    let ob = {}
    ob.t = t
    ob.m = m

    try {
        //
        dispatch({
            type: _OPEN_BACK,
            payload: ob,
        })
        //

    } catch (error) {
        console.log(error)
    }

}
//----------------------------------------------------------------------//
