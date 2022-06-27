/// <reference types="jquery" />
interface IEvents {
    [x: string]: IEvent;
}
interface IEvent {
    event: string;
    publish: (...args: any) => any;
    subscribe: (callback: JQuery.TypeOrArray<Function>, ...callbacks: JQuery.TypeOrArray<Function>[]) => JQuery.Callbacks<Function>;
    unsubscribe: (...callbacks: Function[]) => JQuery.Callbacks<Function>;
}
/**
 * @class EventManager
 * @param {Writer} writer
 */
declare class EventManager {
    doDebug: boolean;
    events: IEvents;
    constructor();
    event(id: string): IEvent;
    /**
     * Get the list of events
     * @returns {Object}
     */
    getEvents(): IEvents;
    destroy(): void;
    /**
     * Whether to output events to the console.
     * @param {Boolean} doIt
     */
    debug(doIt: boolean): void;
}
export default EventManager;
//# sourceMappingURL=eventManager.d.ts.map