class APIFeatures {
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }

    filter() {
        // BUILD THE QUERY
        // 1a) Filtering
        // console.log(this.queryString);
        const queryObj = { ...this.queryString }; // we dont manipulate the req.query object
        const excludedFields = ['page', 'sort', 'limit', 'fields'];
        excludedFields.forEach((el) => delete queryObj[el]); // remove d excluded fields from d queryObj

        // 1b) Advanced Filtering  // formating for the operator ($) // operators gte, gt, lte, lt
        let queryStr = JSON.stringify(queryObj); // converts d queryObj to string
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
        // console.log(JSON.parse(queryStr));

        this.query = this.query.find(JSON.parse(queryStr)); // stores to this.query // returns a Query(object)

        return this; // returns d class object which has access to the prototypes(methods)
    }

    sort() {
        if (this.queryString.sort) {
            // console.log(this.queryString.sort);
            const sortBy = this.queryString.sort.split(',').join(' '); // sorts the sort string
            this.query = this.query.sort(sortBy); // sort is a query prototype funct
            // query.sort('price ratingsAverage')
        } else {
            this.query = this.query.sort('-createdAt');
        }

        return this;
    }

    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields); // includes fields that displays
        } else {
            this.query = this.query.select('-__v');
        }

        return this;
    }

    paginate() {
        const page = this.queryString.page * 1 || 1; // * 1 converts a string to number
        const limit = this.queryString.limit * 1 || 100;
        const skip = (page - 1) * limit;

        // page=2&limit=10, 1-10 page 1, 11-20 page 2, 21-30 page 3
        this.query = this.query.skip(skip).limit(limit);

        return this;
    }
}

module.exports = APIFeatures;
