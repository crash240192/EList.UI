import styles from './EventsMap.module.scss';
import map from '../../assets/images/map.png';

export function EventsMap() {
    return (
        <div className={styles.map}>
            <img className={styles.map_image} src={map} />
        </div>
    );
}