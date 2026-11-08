import { defineComponent, h } from 'vue'
import ReadingServiceAdapterIcon from '../components/ReadingServiceAdapterIcon.vue'

/**
 * Wraps `ReadingServiceAdapterIcon` with one provider's `iconUrl` baked in, so the result can be
 * used as a `SettingsNavItem.icon` (`<component :is="item.icon" :size="15" />`) the same way a
 * plain lucide icon component is.
 */
export function createAdapterIconComponent(iconUrl: string | null | undefined) {
  return defineComponent({
    name: 'ReadingServiceAdapterNavIcon',
    inheritAttrs: false,
    props: { size: { type: [Number, String], default: 16 } },
    setup(props, { attrs }) {
      return () => h(ReadingServiceAdapterIcon, { iconUrl, size: props.size, ...attrs })
    },
  })
}
