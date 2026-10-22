import { MatPaginatorIntl } from '@angular/material/paginator';

export function spanishPaginatorIntl(): MatPaginatorIntl {
    const paginator = new MatPaginatorIntl();
    paginator.itemsPerPageLabel = 'Filas por página:';
    paginator.nextPageLabel = 'Página siguiente';
    paginator.previousPageLabel = 'Página anterior';
    paginator.firstPageLabel = 'Primera página';
    paginator.lastPageLabel = 'Última página';
    paginator.getRangeLabel = (page, pageSize, length) => {
        const total = Math.max(0, length);
        if (!total || !pageSize)
            return `0 de ${total}`;
        const start = page * pageSize;
        return `${start + 1}–${Math.min(start + pageSize, total)} de ${total}`;
    };
    return paginator;
}
