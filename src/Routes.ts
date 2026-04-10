// import { env } from "./env";

// const root = env.VITE_ROOT_FOLDER;

export const routes = {
    // widget: `${root}/widgets/:id`,
    // schedule: `${root}/schedule`,
    // chat: `${root}/chat`,
    
    //login: `${root}/auth`,
    main: '/',
    auth: `/auth`,
    registration: '/registration',
    activation: '/activation',
    searchList: '/list',
    subscriptions: '/subscriptions',
    notifications: '/notifications',
    wallet: '/wallet',

    events: '/events',
    actualEvents: '/events/actual',    
    archivedEvents: '/events/archived'

    // createUser: `${root}/user/create`,
    // editUser: `${root}/user/:id/edit`,
    // userCard: `${root}/user/:id`,
    // usersList: `${root}/users`,
    // emailConfirmed: `${root}/email-confirmed`,
    // resetPassword: `${root}/reset-password`,
    // createMO: `${root}/organization/create`,
    // moList: `${root}/organizations`,
    // createTmCoreArea: `${root}/tm-core-area/create`,
    // editTmCoreArea: `${root}/tm-core-area/:id/edit`,
    // tmCoreAreasList: `${root}/tm-core-areas`,
    // error: `${root}/error`,
    // reportsList: `${root}/reports`,
    // reportCommon: `${root}/report/:systemId/:reportId/common/:id`,
    // reportSplit: `${root}/report/:systemId/:reportId/split/:id`,
    // reportAggregate: `${root}/report/:systemId/:reportId/aggregate/:id`,
    // signinEsia: `${root}/signin-esia`,
    // userProfile: `${root}/user/profile`,
    // vcs: `${root}/vcs`
};