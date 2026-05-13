type PublicResource = {
  isPublic?: boolean;
};

export const canReadResource = (
  resource: PublicResource | null | undefined,
  isLogged: boolean,
) => {
  if (!resource) return false;
  return isLogged || resource.isPublic === true;
};

export const canWriteResource = (isLogged: boolean) => isLogged === true;
