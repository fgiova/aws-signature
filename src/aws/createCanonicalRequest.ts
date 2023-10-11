import {HttpRequest} from "./utils";
import {getPayloadHash} from "./getPayloadHash";
import {getCanonicalQuery} from "./getCanonicalQuery";

function getCanonicalPath({ path }: HttpRequest, isS3: boolean) {
	if (!isS3) {
		// Non-S3 services, we normalize the path and then double URI encode it.
		// Ref: "Remove Dot Segments" https://datatracker.ietf.org/doc/html/rfc3986#section-5.2.4
		const normalizedPathSegments = [];
		for (const pathSegment of path.split("/")) {
			if (pathSegment?.length === 0) continue;
			if (pathSegment === ".") continue;
			if (pathSegment === "..") {
				normalizedPathSegments.pop();
			} else {
				normalizedPathSegments.push(pathSegment);
			}
		}
		// Joining by single slashes to remove consecutive slashes.
		const normalizedPath = `${path?.startsWith("/") ? "/" : ""}${normalizedPathSegments.join("/")}${
			normalizedPathSegments.length > 0 && path?.endsWith("/") ? "/" : ""
		}`;

		const doubleEncoded = encodeURIComponent(normalizedPath);
		return doubleEncoded.replace(/%2F/g, "/");
	}

	// For S3, we shouldn't normalize the path. For example, object name
	// my-object//example//photo.user should not be normalized to
	// my-object/example/photo.user
	return path;
}

export function createCanonicalRequest(request: HttpRequest, canonicalHeaders: Record<string, string>, isS3= false) {
	const sortedHeaders = Object.keys(canonicalHeaders).sort();
	return `${request.method}
${getCanonicalPath(request, isS3)}
${getCanonicalQuery(request)}
${sortedHeaders.map((name) => `${name}:${canonicalHeaders[name]}`).join("\n")}

${sortedHeaders.join(";")}
${getPayloadHash(request)}`;
}