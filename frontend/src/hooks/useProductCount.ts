import { useEffect, useState } from 'react'
import { getProductCount } from '../services/productMaster'

type ProductCountState = {
  count: number | null
  error: string | null
  isLoading: boolean
}

export function useProductCount(businessId?: string): ProductCountState {
  const [state, setState] = useState<ProductCountState>({ count: null, error: null, isLoading: Boolean(businessId) })

  useEffect(() => {
    if (!businessId) {
      setState({ count: null, error: null, isLoading: false })
      return
    }

    let isCurrent = true
    setState({ count: null, error: null, isLoading: true })
    void getProductCount(businessId)
      .then((count) => {
        if (isCurrent) setState({ count, error: null, isLoading: false })
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setState({ count: null, error: error instanceof Error ? error.message : 'ไม่สามารถโหลดจำนวนสินค้าได้', isLoading: false })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [businessId])

  return state
}
