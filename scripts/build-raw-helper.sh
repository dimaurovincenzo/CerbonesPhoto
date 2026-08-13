#!/usr/bin/env bash
set -euo pipefail

readonly LIBRAW_VERSION='0.22.2'
readonly LIBRAW_SHA256='46e9cec8798419775df1411cc4554bb023e003509ff44b4057fd3b84eb55a517'
readonly LIBRAW_URL="https://www.libraw.org/data/LibRaw-${LIBRAW_VERSION}-macOS.zip"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"
target_dir="${project_dir}/resources/bin/darwin-arm64"
license_dir="${project_dir}/resources/licenses/libraw"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/cerbonesphoto-libraw.XXXXXX")"
trap 'rm -rf "${build_dir}"' EXIT

archive_path="${build_dir}/libraw.zip"
curl --fail --location --silent --show-error "${LIBRAW_URL}" --output "${archive_path}"

actual_sha256="$(shasum -a 256 "${archive_path}" | awk '{print $1}')"
if [[ "${actual_sha256}" != "${LIBRAW_SHA256}" ]]; then
  echo "Checksum LibRaw non valido: atteso ${LIBRAW_SHA256}, ricevuto ${actual_sha256}" >&2
  exit 1
fi

unzip -q "${archive_path}" -d "${build_dir}/archive"
source_dir="${build_dir}/archive/LibRaw-${LIBRAW_VERSION}"
source_binary="${source_dir}/bin/simple_dcraw"
if [[ ! -f "${source_binary}" ]]; then
  echo "Il pacchetto LibRaw non contiene bin/simple_dcraw" >&2
  exit 1
fi

binary_info="$(file "${source_binary}")"
if [[ "${binary_info}" != *'arm64'* ]]; then
  echo "Il binario LibRaw non è arm64: ${binary_info}" >&2
  exit 1
fi

mkdir -p "${target_dir}" "${license_dir}"
cp "${source_binary}" "${target_dir}/simple_dcraw"
chmod 0755 "${target_dir}/simple_dcraw"

for license_name in LICENSE.LGPL LICENSE.CDDL; do
  if [[ -f "${source_dir}/${license_name}" ]]; then
    cp "${source_dir}/${license_name}" "${license_dir}/${license_name}"
  fi
done

echo "LibRaw ${LIBRAW_VERSION} pronto in ${target_dir}/simple_dcraw"
