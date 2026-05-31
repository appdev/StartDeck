type PublicResource = {
  isPublic?: boolean;
};

export const canReadResource = (
  resource: PublicResource | null | undefined,
  _isLogged: boolean,
) => {
  if (!resource) return false;
  return true;
};

export const canWriteResource = (isLogged: boolean) => isLogged === true;
