import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy } from '@angular/core';

@Directive({ selector: '[monitorCanvasNavigation]', standalone: true })
export class CanvasNavigationDirective implements AfterViewInit, OnDestroy {
    // Trackpad pinch is delivered as Ctrl+wheel. Cancel the browser's page
    // zoom/scroll while still letting ECharts and Leaflet handle the event.
    private readonly containWheel = (event: WheelEvent) => event.preventDefault();

    constructor(private element: ElementRef<HTMLElement>, private zone: NgZone) { }

    ngAfterViewInit() {
        this.zone.runOutsideAngular(() => {
            this.element.nativeElement.addEventListener('wheel', this.containWheel, { capture: true, passive: false });
        });
    }

    ngOnDestroy() {
        this.element.nativeElement.removeEventListener('wheel', this.containWheel, true);
    }
}
