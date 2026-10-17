import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { useApi } from "./useApi";

describe("useApi", () => {
  it("começa carregando e depois entrega os dados", async () => {
    const { result } = renderHook(() => useApi(() => Promise.resolve({ total: 3 }), []));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ total: 3 });
    expect(result.current.error).toBeUndefined();
  });

  it("preenche error quando a promessa rejeita com ApiError", async () => {
    const err = new ApiError(500, "UNKNOWN", "Algo deu errado. Tente novamente.");
    const { result } = renderHook(() => useApi(() => Promise.reject(err), []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(err);
    expect(result.current.data).toBeUndefined();
  });

  it("converte erro inesperado em ApiError", async () => {
    const { result } = renderHook(() => useApi(() => Promise.reject(new Error("boom")), []));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.code).toBe("UNKNOWN");
  });

  it("reload chama load de novo", async () => {
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const { result } = renderHook(() => useApi(load, []));
    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("deps novas disparam um novo load", async () => {
    const load = vi.fn((days: number) => Promise.resolve(days));
    const { result, rerender } = renderHook(({ days }) => useApi(() => load(days), [days]), {
      initialProps: { days: 12 },
    });
    await waitFor(() => expect(result.current.data).toBe(12));

    rerender({ days: 30 });
    await waitFor(() => expect(result.current.data).toBe(30));
  });

  it("ignora resultado que chega depois do unmount", async () => {
    let resolve!: (value: number) => void;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useApi(() => new Promise<number>((r) => (resolve = r)), []));

    unmount();
    await act(async () => resolve(1));
    expect(result.current.data).toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("resposta antiga não sobrescreve a mais nova", async () => {
    const resolvers: Array<(value: string) => void> = [];
    const { result, rerender } = renderHook(
      ({ q }) => useApi(() => new Promise<string>((r) => resolvers.push(r)), [q]),
      { initialProps: { q: "a" } },
    );

    rerender({ q: "b" });
    await act(async () => resolvers[1]("b"));
    await act(async () => resolvers[0]("a"));
    expect(result.current.data).toBe("b");
  });
});
