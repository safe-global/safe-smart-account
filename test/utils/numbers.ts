const getRandomInt = (min = 0, max: number = Number.MAX_SAFE_INTEGER): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomIntAsString = (min = 0, max: number = Number.MAX_SAFE_INTEGER): string => {
    return getRandomInt(min, max).toString();
};

export { getRandomInt, getRandomIntAsString };
