"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{
    data: T | null;
    error: string;
    loading: boolean;
  }>({
    data: null,
    error: "",
    loading: true,
  });

  const [version, setVersion] = useState(0);
  const current = useRef(loader);

  current.current = loader;

  useEffect(() => {
    const controller = new AbortController();

    setState({
      data: null,
      error: "",
      loading: true,
    });

    current
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({
            data,
            error: "",
            loading: false,
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({
            data: null,
            error: errorMessage(error),
            loading: false,
          });
        }
      });

    return () => controller.abort();
  }, [loader, version]);

  const reload = useCallback(() => {
    setVersion((value) => value + 1);
  }, []);

  return {
    ...state,
    reload,
  };
}
