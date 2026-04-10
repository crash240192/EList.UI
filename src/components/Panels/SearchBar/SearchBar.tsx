import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { EventsSearchRequest } from '../../../api/models/Events/EventsSearchRequest';
import { loadAllEventCategories, loadAllEventTypes, loadGlobalEvents } from '../../../redux/reducers/EventsReducer';
import styles from './SearchBar.module.scss'
import filtersIco from '../../../assets/images/filters.png';
import searchIco from '../../../assets/images/search.png';
import { ReduxState } from '../../../redux/store';
import { useEffect, useState } from 'react';

export function SearchBar() {
    const dispatch = useDispatch();
    const [showAdvancedParams, setShowAdvancedParams] = useState(false)
    const { eventCategories } = useSelector(({ events }: ReduxState) => events, shallowEqual);
    const { eventTypes } = useSelector(({ events }: ReduxState) => events, shallowEqual);
    const [searchString, setSearchstring] = useState('search some');
    useEffect(() => {
        if (!eventCategories)
            dispatch(loadAllEventCategories());
        if (!eventTypes)
            dispatch(loadAllEventTypes());
    }, [eventTypes, eventCategories])

    function searchEvents() {
        let searchRequest: EventsSearchRequest = {
            allowedGender: null,
            startTime: null,
            endTime: null,
            categories: null,
            types: null,
            price: null,
            participantId: null,
            organizatorId: null,
            longitude: null,
            latitude: null,
            locationRange: null,
            pageIndex: null,
            pageSize: null,
        }
        dispatch(loadGlobalEvents(searchRequest))
    }

    function ShowAdvancedParams() {
        return (
            <>
                <div className={styles.divider}></div>
                <div className={styles.advanced_options}>
                    <div>
                        (Выбранные типы)
                    </div>

                    <div>
                        <label htmlFor='startDate'>Дата начала </label>
                        <input id="startDate" type="date" />
                    </div>
                    <div>
                        <label htmlFor='endDate'>Дата завершения </label>
                        <input id="endDate" type="date" />
                    </div>
                </div>
            </>
        );
    }

    return (
        <div className={styles.search_panel}>

            <div className={styles.search_row}>
                <input className={styles.search_input} value={searchString} onChange={e => setSearchstring(e.currentTarget.value)}></input>

                <button className={styles.search_button} onClick={() => searchEvents()} >
                    <img className={styles.search_icon} src={searchIco}></img>
                </button>
                <button className={styles.search_button} onClick={() => setShowAdvancedParams(!showAdvancedParams)}>
                    <img className={styles.search_icon} src={filtersIco} ></img>
                </button>
            </div>
            
            <div>
                {
                    showAdvancedParams && ShowAdvancedParams()
                }
            </div>

        </div>
    );
}