import { queryClient } from '@/components/providers/RootProviders'
import { ItemData } from '@/utils/types/item'
import { queryOptions } from '@tanstack/react-query'
import httpClient from '../httpClient'

export const templatesQueryOptions = () => queryOptions<ItemData[]>({
    queryKey: ['templates'],
    queryFn: async () => await httpClient().get(`templates`),
})

export const templateQueryOptions = (templateId: ItemData['id']) => queryOptions<ItemData>({
    queryKey: ['template', templateId],
    queryFn: async () => await httpClient().get(`templates/${templateId}`),
})

export const setupTemplatesCache = (templates: ItemData[]) =>
    templates.forEach(template => {
        queryClient.setQueryData(['template', template.id], template)
    })

export const mutateTemplateCache = (data: ItemData, type: "edit" | "add" | "delete") => {
    const templatesKey = ['templates'];

    if (queryClient.getQueryData(templatesKey))
        queryClient.setQueryData(templatesKey, (oldData: ItemData[]) => {
            if (!oldData) return oldData;
            const index = type !== 'add' && oldData.findIndex((template) => template.id === data.id);

            switch (type) {
                case 'add':
                    oldData.push(data);
                    oldData.sort((a, b) => a.title.localeCompare(b.title));
                    return oldData;
                case 'delete':
                    oldData.splice(index as number, 1);
                    return oldData;
                case 'edit':
                    oldData[index as number] = data
                    oldData.sort((a, b) => a.title.localeCompare(b.title));
                    return oldData;
            }
        });

    queryClient.setQueryData(['template', data.id], data)
}
