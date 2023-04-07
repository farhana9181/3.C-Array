//Employee monthly recieve amount.....
#include<iostream>
using namespace std;
struct employee{

    int id ;
    float salary;
    float work;
    float amount ;

};
int main ()
{
    employee e1;
    cout <<" Enter a Id =";
    cin >> e1.id;
    cout<< "Work Our in a month =";
    cin >> e1.work;
    cout<< "Amount recieves per hour =";
    cin >> e1.amount;
    e1.salary = e1.work * e1.amount;
    cout<< "**Salary** ==" << e1.salary <<"TK";
}

